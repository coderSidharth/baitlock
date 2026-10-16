import os
import requests
import json
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

def analyze_text_with_llm(text_content: str) -> dict:
    """
    Calls the configured LLM to analyze the page text or email body
    for phishing cues (urgency, impersonation, tone).
    Returns a dictionary with 'llm_score' and 'llm_reason'.
    """
    if not text_content or len(text_content.strip()) < 10:
        return {"llm_score": 0, "llm_reason": "Not enough text to analyze."}

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
    "{text_content}"
    """

    if LLM_PROVIDER.lower() == "groq":
        try:
            payload = {
                "model": GROQ_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.1
            }
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=120)
            res.raise_for_status()
            
            raw_text = res.json()["choices"][0]["message"]["content"].strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
                
            data = json.loads(raw_text)
            
            # Invert the score: LLM outputs 100 for high threat, Baitlock expects 0 for high threat
            inverted_score = 100 - data.get("threat_score", 0)
            
            return {
                "llm_score": inverted_score,
                "llm_reason": data.get("explanation", "Analyzed by Groq.")
            }
        except Exception as e:
            return {"llm_score": 0, "llm_reason": f"Groq API error: {str(e)}"}

    else:
        # Default to Ollama
        try:
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": prompt,
                "stream": False,
                "format": "json"
            }
            res = requests.post(OLLAMA_URL, json=payload, timeout=120)
            res.raise_for_status()
            response_json = res.json()
            # Ollama with format="json" tries to guarantee JSON output
            raw_text = response_json.get("response", "{}").strip()
            if raw_text.startswith("```json"):
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif raw_text.startswith("```"):
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
            data = json.loads(raw_text)
            
            # Invert the score: LLM outputs 100 for high threat, Baitlock expects 0 for high threat
            inverted_score = 100 - data.get("threat_score", 0)
            
            return {
                "llm_score": inverted_score,
                "llm_reason": data.get("explanation", "Analyzed by Ollama.")
            }
        except Exception as e:
            print(f"Ollama error: {e}")
            return {"llm_score": 0, "llm_reason": f"Ollama local API error: {str(e)}"}

def chat_with_llm(messages: list) -> dict:
    """
    Generic chat functionality using the configured LLM, supporting tool calls.
    Returns the message object which may contain 'content' and 'tool_calls'.
    """
    if LLM_PROVIDER.lower() == "groq":
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
            
            payload = {
                "model": GROQ_MODEL,
                "messages": messages,
                "temperature": 0.3,
                "tools": tools,
                "tool_choice": "auto"
            }
            headers = {
                "Authorization": f"Bearer {GROQ_API_KEY}",
                "Content-Type": "application/json"
            }
            res = requests.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers, timeout=120)
            res.raise_for_status()
            
            msg = res.json()["choices"][0]["message"]
            
            # Polyfill for tool calls encoded in content strings
            import re
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
        except Exception as e:
            return {"role": "assistant", "content": f"Groq API error: {str(e)}"}
    else:
        # Default to Ollama fallback (no tools)
        try:
            last_msg = messages[-1]["content"] if messages else ""
            payload = {
                "model": OLLAMA_MODEL,
                "prompt": f"User: {last_msg}\nBaitlock:",
                "stream": False
            }
            res = requests.post(OLLAMA_URL, json=payload, timeout=120)
            res.raise_for_status()
            response_json = res.json()
            return {"role": "assistant", "content": response_json.get("response", "Sorry, I couldn't generate a response.").strip()}
        except Exception as e:
            print(f"Ollama error: {e}")
            return {"role": "assistant", "content": f"Ollama local API error: {str(e)}"}
