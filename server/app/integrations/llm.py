import requests
import json
import logging
import threading
from app.core.config import settings

logger = logging.getLogger("baitlock.llm")

def get_llm_config():
    """Return LLM provider settings from the central config (not raw os.getenv)."""
    return {
        "provider": settings.LLM_PROVIDER.lower(),
        "ollama_model": settings.OLLAMA_MODEL,
        "ollama_url": settings.OLLAMA_URL,
        "ollama_chat_url": settings.OLLAMA_CHAT_URL,
        "groq_api_key": settings.GROQ_API_KEY,
        "groq_model": settings.GROQ_MODEL,
    }

_llm_slots = threading.BoundedSemaphore(settings.LLM_MAX_CONCURRENT)


def _analysis_result(data: dict) -> dict:
    """An incomplete model response must never become a confident safe score."""
    score = data["threat_score"]
    reason = data["explanation"]
    if isinstance(score, bool) or not isinstance(score, (int, float)) or not 0 <= score <= 100:
        raise ValueError("Invalid threat score")
    if not isinstance(reason, str) or not reason.strip():
        raise ValueError("Invalid explanation")
    return {"llm_score": 100 - int(score), "llm_reason": reason.strip()[:1000]}


def _post_json(url: str, **kwargs) -> dict:
    if not _llm_slots.acquire(blocking=False):
        raise requests.RequestException("AI capacity exhausted")
    try:
        with requests.post(url, timeout=(2, settings.LLM_TIMEOUT_SECONDS), **kwargs) as response:
            response.raise_for_status()
            return response.json()
    finally:
        _llm_slots.release()


def _call_groq_api(payload: dict, api_key: str) -> tuple[dict | None, str | None]:
    try:
        return _post_json("https://api.groq.com/openai/v1/chat/completions", json=payload,
                          headers={"Authorization": f"Bearer {api_key}"}), None
    except requests.HTTPError as exc:
        return None, "RATE_LIMIT" if exc.response is not None and exc.response.status_code == 429 else "HTTP_ERROR"
    except (requests.RequestException, ValueError):
        return None, "CONNECTION_ERROR"


def _analyze_with_groq(prompt: str, groq_model: str, groq_api_key: str) -> dict | None:
    if not groq_api_key:
        return None
    payload = {
        "model": groq_model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    }
    res_data, error = _call_groq_api(payload, groq_api_key)
    if error == "RATE_LIMIT":
        return {"llm_score": None, "llm_reason": "AI deep inspection temporarily deferred due to high load."}
    elif error or not res_data:
        return None

    try:
        raw_text = res_data["choices"][0]["message"]["content"].strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
        data = json.loads(raw_text)
        return _analysis_result(data)
    except Exception as e:
        logger.error("Groq response parsing error: %s", e, exc_info=True)
        return {"llm_score": None, "llm_reason": "AI analysis encountered a parsing error."}

def _analyze_with_ollama(prompt: str, ollama_model: str, ollama_url: str) -> dict | None:
    try:
        payload = {
            "model": ollama_model,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }
        response_json = _post_json(ollama_url, json=payload)
        raw_text = response_json.get("response", "{}").strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
        
        data = json.loads(raw_text)
        return _analysis_result(data)
    except Exception:
        return None

def analyze_text_with_llm(text_content: str) -> dict:
    """
    Calls the configured LLM to analyze the page text or email body
    for phishing cues (urgency, impersonation, tone).
    Falls back gracefully between Groq and Ollama if one is unavailable.
    """
    if not text_content or len(text_content.strip()) < 10:
        return {"llm_score": None, "llm_reason": "Not enough text to analyze."}

    config = get_llm_config()
    provider = config["provider"]
    ollama_model = config["ollama_model"]
    ollama_url = config["ollama_url"]
    groq_api_key = config["groq_api_key"]
    groq_model = config["groq_model"]

    sanitized_text = text_content[:2000].strip()
    prompt = f"""
    You are an expert cybersecurity AI. Analyze the following text (from an email or website) for phishing indicators.
    Look for:
    1. Unreasonable sense of urgency.
    2. Requests for sensitive information (passwords, SSN).
    3. Impersonation of authority (banks, IT support, executives).
    4. Poor grammar or unprofessional tone mixed with professional claims.

    Provide your assessment in the following exact JSON format without any markdown or extra text:
    {{
        "threat_score": <integer from 0 to 100, where 100 is highest threat/definite phishing, and 0 is completely safe>,
        "explanation": "<a concise 1-2 sentence explanation of why>"
    }}

    Text to analyze:
    "{sanitized_text}"
    """

    if provider == "groq":
        result = _analyze_with_groq(prompt, groq_model, groq_api_key)
        if result is not None:
            return result
        # Fallback to Ollama if available
        ollama_res = _analyze_with_ollama(prompt, ollama_model, ollama_url)
        if ollama_res is not None:
            return ollama_res
        return {"llm_score": None, "llm_reason": "AI deep inspection temporarily unavailable."}
    else:
        # Default/Ollama mode
        ollama_res = _analyze_with_ollama(prompt, ollama_model, ollama_url)
        if ollama_res is not None:
            return ollama_res
        # Seamless fallback to Groq if key is present
        if groq_api_key:
            groq_res = _analyze_with_groq(prompt, groq_model, groq_api_key)
            if groq_res is not None:
                return groq_res
        return {"llm_score": None, "llm_reason": "AI service currently unreachable."}


CHAT_TOOLS = [
        {
            "type": "function",
            "function": {
                "name": "add_to_whitelist",
                "description": "Add a domain to the user's whitelist so it is never blocked.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "domain": {"type": "string", "description": "The domain name (e.g. google.com)"}
                    },
                    "required": ["domain"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "remove_from_whitelist",
                "description": "Remove a domain from the user's whitelist.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "domain": {"type": "string", "description": "The domain name"}
                    },
                    "required": ["domain"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_to_blocklist",
                "description": "Add a domain to the user's explicit blocklist so it is always blocked.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "domain": {"type": "string", "description": "The domain name"}
                    },
                    "required": ["domain"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "remove_from_blocklist",
                "description": "Remove a domain from the user's blocklist.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "domain": {"type": "string", "description": "The domain name"}
                    },
                    "required": ["domain"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "clear_logs",
                "description": "Clear all recent event logs from the database.",
                "parameters": {
                    "type": "object",
                    "properties": {}
                }
            }
        }
    ]


def _chat_with_groq(messages: list, groq_model: str, groq_api_key: str) -> dict:

    
    payload = {
        "model": groq_model,
        "messages": messages,
        "temperature": 0.3,
        "tools": CHAT_TOOLS,
        "tool_choice": "auto"
    }

    res_data, error = _call_groq_api(payload, groq_api_key)
    if error == "RATE_LIMIT":
        return {
            "role": "assistant",
            "content": "⏳ **Baitlock AI is momentarily busy processing high-volume security requests.**\n\nPlease wait a few moments (15–30 seconds) for the security engine quota to refresh, then ask your question again."
        }
    elif error or not res_data:
        return {
            "role": "assistant",
            "content": "⚠️ **Unable to reach the AI security engine at this moment.** Please wait a moment and try again."
        }

    try:
        msg = res_data["choices"][0]["message"]
        
        return msg
    except Exception:
        return {"role": "assistant", "content": "⚠️ **An unexpected response occurred.** Please try again."}

def _ollama_messages(messages: list) -> list[dict]:
    converted = []
    for message in messages:
        role = message.get("role", "user")
        item = {"role": role, "content": message.get("content") or ""}
        if role == "tool":
            item["tool_name"] = message.get("name") or message.get("tool_name", "")
        elif role == "assistant" and message.get("tool_calls"):
            item["tool_calls"] = []
            for call in message["tool_calls"]:
                function = call.get("function", {})
                arguments = function.get("arguments", {})
                if isinstance(arguments, str):
                    try:
                        arguments = json.loads(arguments)
                    except json.JSONDecodeError:
                        arguments = {}
                item["tool_calls"].append({
                    "function": {
                        "name": function.get("name", ""),
                        "arguments": arguments if isinstance(arguments, dict) else {},
                    }
                })
        converted.append(item)
    return converted


def _chat_with_ollama(messages: list, ollama_model: str, ollama_chat_url: str) -> dict | None:
    try:
        payload = {
            "model": ollama_model,
            "messages": _ollama_messages(messages),
            "tools": CHAT_TOOLS,
            "stream": False,
        }
        response_message = _post_json(ollama_chat_url, json=payload).get("message") or {}
        tool_calls = []
        for index, call in enumerate(response_message.get("tool_calls") or []):
            function = call.get("function") or {}
            arguments = function.get("arguments", {})
            if not isinstance(arguments, str):
                arguments = json.dumps(arguments)
            tool_calls.append({
                "id": call.get("id") or f"ollama_{len(messages)}_{index}",
                "type": "function",
                "function": {
                    "name": function.get("name", ""),
                    "arguments": arguments,
                },
            })
        result = {
            "role": "assistant",
            "content": (response_message.get("content") or "").strip(),
        }
        if tool_calls:
            result["tool_calls"] = tool_calls
        return result
    except Exception:
        return None

def chat_with_llm(messages: list) -> dict:
    """
    Generic chat functionality using the configured LLM, supporting tool calls.
    Falls back gracefully between Groq and Ollama.
    """
    config = get_llm_config()
    provider = config.get("provider", "groq").lower()
    groq_api_key = config.get("groq_api_key", "")
    groq_model = config.get("groq_model", "openai/gpt-oss-20b")
    ollama_model = config.get("ollama_model", "llama3.1:8b")
    ollama_chat_url = config.get("ollama_chat_url", "http://localhost:11434/api/chat")

    if provider == "groq" and groq_api_key:
        return _chat_with_groq(messages, groq_model, groq_api_key)
    elif provider == "ollama":
        res = _chat_with_ollama(messages, ollama_model, ollama_chat_url)
        if res is not None:
            return res
        # Auto-fallback to Groq if configured
        if groq_api_key:
            return _chat_with_groq(messages, groq_model, groq_api_key)
        return {
            "role": "assistant",
            "content": "⚠️ **Local AI service (Ollama) is currently unreachable.** Ensure Ollama is running or configure Groq in your .env settings."
        }
    else:
        # Provider is groq but missing key, or unknown provider
        if groq_api_key:
            return _chat_with_groq(messages, groq_model, groq_api_key)
        res = _chat_with_ollama(messages, ollama_model, ollama_chat_url)
        if res is not None:
            return res
        return {
            "role": "assistant",
            "content": "⚠️ **No AI service available.** Please provide a valid GROQ_API_KEY in your server/.env file or run Ollama locally."
        }
