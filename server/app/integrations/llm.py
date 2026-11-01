import os
import requests
import json
import time
import re
from dotenv import load_dotenv

def get_llm_config():
    load_dotenv(override=True)
    return {
        "provider": os.getenv("LLM_PROVIDER", "groq"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "llama3.1:8b"),
        "ollama_url": os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate"),
        "groq_api_key": os.getenv("GROQ_API_KEY", ""),
        "groq_model": os.getenv("GROQ_MODEL", "openai/gpt-oss-20b"),
    }

def _call_groq_api(payload: dict, api_key: str, max_retries: int = 2) -> tuple[dict | None, str | None]:
    """
    Calls Groq chat completions with automatic exponential backoff retry on 429 rate limits.
    Returns (response_json, error_code).
    """
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    url = "https://api.groq.com/openai/v1/chat/completions"

    for attempt in range(max_retries + 1):
        try:
            res = requests.post(url, json=payload, headers=headers, timeout=120)
            if res.status_code == 200:
                return res.json(), None
            elif res.status_code == 429:
                if attempt < max_retries:
                    retry_after = res.headers.get("Retry-After")
                    wait_seconds = 2.0 * (attempt + 1)
                    if retry_after:
                        try:
                            wait_seconds = min(max(float(retry_after), 1.0), 6.0)
                        except (ValueError, TypeError):
                            pass
                    time.sleep(wait_seconds)
                    continue
                return None, "RATE_LIMIT"
            else:
                return None, f"HTTP_{res.status_code}"
        except requests.exceptions.RequestException:
            if attempt < max_retries:
                time.sleep(1.5)
                continue
            return None, "CONNECTION_ERROR"
        except Exception:
            return None, "UNKNOWN_ERROR"

    return None, "RATE_LIMIT"

def analyze_text_with_llm(text_content: str) -> dict:
    """
    Calls the configured LLM to analyze the page text or email body
    for phishing cues (urgency, impersonation, tone).
    Returns a dictionary with 'llm_score' and 'llm_reason'.
    """
    if not text_content or len(text_content.strip()) < 10:
        return {"llm_score": None, "llm_reason": "Not enough text to analyze."}

    config = get_llm_config()
    llm_provider = config["provider"]
    ollama_model = config["ollama_model"]
    ollama_url = config["ollama_url"]
    groq_api_key = config["groq_api_key"]
    groq_model = config["groq_model"]

    # Truncate to first 2,000 characters to stay well within TPM quotas
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

<<<<<<< HEAD
    config = get_llm_config()
    provider = config.get("provider", "groq").lower()
    groq_api_key = config.get("groq_api_key", "")
    groq_model = config.get("groq_model", "openai/gpt-oss-20b")
    ollama_model = config.get("ollama_model", "llama3.1:8b")
    ollama_url = config.get("ollama_url", "http://localhost:11434/api/generate")

    if provider == "groq":
        payload = {
            "model": groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.1
        }
        res_data, error = _call_groq_api(payload, groq_api_key)
        if error == "RATE_LIMIT":
            return {"llm_score": 50, "llm_reason": "AI deep inspection temporarily deferred due to high load."}
        elif error or not res_data:
            return {"llm_score": 50, "llm_reason": "AI deep inspection temporarily unavailable."}

        try:
            raw_text = res_data["choices"][0]["message"]["content"].strip()
=======
    if llm_provider.lower() == "groq":
        try:
            payload = {
                "model": groq_model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            headers = {
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=120)
            res.raise_for_status()
            
            raw_text = res.json()["choices"][0]["message"]["content"].strip()
>>>>>>> temp-fixes
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(raw_text)
            
            # Invert the score: LLM outputs 100 for high threat, Baitlock expects 0 for high threat
            inverted_score = 100 - data.get("threat_score", 0)
            
            return {
                "llm_score": inverted_score,
                "llm_reason": data.get("explanation", "Analyzed by AI.")
            }
<<<<<<< HEAD
        except Exception:
            return {"llm_score": 50, "llm_reason": "Analyzed by AI."}
=======
        except Exception as e:
            return {"llm_score": None, "llm_reason": f"Groq API error: {str(e)}"}
>>>>>>> temp-fixes

    else:
        # Default to Ollama
        try:
            payload = {
                "model": ollama_model,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }
            res = requests.post(ollama_url, json=payload, timeout=120)
            res.raise_for_status()
            response_json = res.json()
            raw_text = response_json.get("response", "{}").strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(raw_text)
            inverted_score = 100 - data.get("threat_score", 0)
            
            return {
                "llm_score": inverted_score,
                "llm_reason": data.get("explanation", "Analyzed by Ollama.")
            }
<<<<<<< HEAD
        except Exception:
            return {"llm_score": 50, "llm_reason": "AI deep inspection temporarily deferred."}
=======
        except Exception as e:
            print(f"Ollama error: {e}")
            return {"llm_score": None, "llm_reason": f"Ollama local API error: {str(e)}"}
>>>>>>> temp-fixes

def chat_with_llm(messages: list) -> dict:
    """
    Generic chat functionality using the configured LLM, supporting tool calls.
    Returns the message object which may contain 'content' and 'tool_calls'.
    """
    config = get_llm_config()
<<<<<<< HEAD
    provider = config.get("provider", "groq").lower()
    groq_api_key = config.get("groq_api_key", "")
    groq_model = config.get("groq_model", "openai/gpt-oss-20b")
    ollama_model = config.get("ollama_model", "llama3.1:8b")
    ollama_url = config.get("ollama_url", "http://localhost:11434/api/generate")

    if provider == "groq":
        tools = [
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
=======
    llm_provider = config["provider"]
    ollama_model = config["ollama_model"]
    ollama_url = config["ollama_url"]
    groq_api_key = config["groq_api_key"]
    groq_model = config["groq_model"]

    if llm_provider.lower() == "groq":
        try:
            tools = [
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
>>>>>>> temp-fixes
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
<<<<<<< HEAD
            }
        ]
        
        payload = {
            "model": groq_model,
            "messages": messages,
            "temperature": 0.3,
            "tools": tools,
            "tool_choice": "auto"
        }

        res_data, error = _call_groq_api(payload, groq_api_key)
        if error == "RATE_LIMIT":
            return {
                "role": "assistant",
                "content": "⏳ **Baitlock AI is momentarily busy processing high-volume security requests.**\n\nPlease wait a few moments (15–30 seconds) for the security engine quota to refresh, then ask your question again."
=======
            ]
            
            payload = {
                "model": groq_model,
                "messages": messages,
                "temperature": 0.3,
                "tools": tools,
                "tool_choice": "auto"
            }
            headers = {
                "Authorization": f"Bearer {groq_api_key}",
                "Content-Type": "application/json"
>>>>>>> temp-fixes
            }
        elif error or not res_data:
            return {
                "role": "assistant",
                "content": "⚠️ **Unable to reach the AI security engine at this moment.** Please wait a moment and try again."
            }

        try:
            msg = res_data["choices"][0]["message"]
            
            # Polyfill for tool calls encoded in content strings
            if msg.get("content") and "<function=" in msg["content"]:
                matches = re.finditer(r'<function=(.*?)>(.*?)</function>', msg["content"], re.DOTALL)
                if not msg.get("tool_calls"):
                    msg["tool_calls"] = []
                for idx, match in enumerate(matches):
                    func_name = match.group(1)
                    args = match.group(2)
                    msg["tool_calls"].append({
                        "id": f"call_{idx}",
                        "type": "function",
                        "function": {
                            "name": func_name,
                            "arguments": args
                        }
                    })
                # Strip it from content so the raw text isn't leaked
                msg["content"] = re.sub(r'<function=.*?>.*?</function>', '', msg["content"], flags=re.DOTALL).strip()
                
            return msg
        except Exception:
            return {"role": "assistant", "content": "⚠️ **An unexpected response occurred.** Please try again."}
    else:
        # Default to Ollama fallback (no tools)
        try:
            last_msg = messages[-1]["content"] if messages else ""
            payload = {
                "model": ollama_model,
                "prompt": f"User: {last_msg}\nBaitlock:",
                "stream": False
            }
            res = requests.post(ollama_url, json=payload, timeout=120)
            res.raise_for_status()
            response_json = res.json()
            return {"role": "assistant", "content": response_json.get("response", "Sorry, I couldn't generate a response.").strip()}
        except Exception:
            return {"role": "assistant", "content": "⚠️ **Local AI service (Ollama) is currently unreachable.** Ensure Ollama is running or configure Groq in your .env settings."}
