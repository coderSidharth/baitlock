from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.rate_limit import FailedLoginLimiter
import logging
from typing import List
from app.api.deps import get_db, get_current_user
from app.features.auth.models import User
from app.features.chat.models import ChatMessage
from app.features.chat.schemas import ChatMessageCreate, ChatMessageOut, ChatHistoryResponse
from app.integrations.llm import chat_with_llm

router = APIRouter()
chat_limiter = FailedLoginLimiter(10, 60)
logger = logging.getLogger(__name__)

from app.features.phishing.models import UserWhitelist, UserBlocklist, PhishingEvent
from app.features.phishing.service import normalize_domain, set_whitelisted, set_blocklisted
from app.features.fraud.models import FraudEvent
import json

@router.post("", response_model=ChatMessageOut)
def send_chat_message(
    msg: ChatMessageCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    wait = chat_limiter.consume((str(user_id), "chat"))
    if wait:
        raise HTTPException(429, "Chat rate limit reached", headers={"Retry-After": str(wait)})
    # Save user message
    user_msg = ChatMessage(user_id=user_id, role="user", content=msg.content)
    db.add(user_msg)
    db.commit()
    
    # Fetch recent clean messages in chronological order to save tokens
    recent_history = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc()).limit(10).all()
    history = [h for h in reversed(recent_history) if not any(err in (h.content or "") for err in ["Groq API error", "Ollama local API", "Client Error:"])]
    
    # Gather live telemetry for assistant context (counts only — never send
    # full domain lists to a third-party LLM; that would leak user data and
    # risk prompt injection via adversarial domain names).
    block_count = db.query(UserBlocklist).filter(UserBlocklist.user_id == user_id).count()
    white_count = db.query(UserWhitelist).filter(UserWhitelist.user_id == user_id).count()
    summaries = [db.query(func.count(model.id), func.coalesce(func.sum(model.final_score), 0)).filter(
        model.user_id == user_id).one() for model in (PhishingEvent, FraudEvent)]
    total_events = sum(row[0] for row in summaries)
    avg_score = round(sum(row[1] for row in summaries) / total_events, 1) if total_events else 100
    critical_count = db.query(PhishingEvent).filter(PhishingEvent.user_id == user_id, PhishingEvent.verdict.like("%CRITICAL%")).count() + db.query(FraudEvent).filter(FraudEvent.user_id == user_id, FraudEvent.verdict.like("%FRAUD%")).count()

    system_prompt = f"""You are Baitlock AI, an expert agentic cybersecurity shield and assistant.
You have real-time access to the user's security posture and threat intelligence telemetry.

LIVE SYSTEM POSTURE:
- Overall Security Score: {avg_score}/100
- Total Monitored Events: {total_events}
- High & Critical Threats Intercepted: {critical_count}
- Active Blocklist: {block_count} domains
- Active Whitelist: {white_count} domains

FORMATTING GUIDELINES:
- Deliver well-structured, visually appealing, concise responses.
- When presenting status, comparisons, or multi-field data, use clean markdown tables with headers (e.g., | Metric | Value | Status |).
- Use bullet points for takeaways, recommendations, or steps.
- Enclose domain names, IPs, and technical identifiers in `code` tags.
- When the user asks for tools/actions (block, whitelist, clear logs), invoke the tool and confirm clearly.
- Maintain an authoritative, sharp, and helpful security analyst tone.
"""

    messages = [{"role": "system", "content": system_prompt}]
    for h in history:
        messages.append({"role": h.role, "content": h.content})
    
    try:
        response_msg = chat_with_llm(messages)
        
        tool_results = []
        # Model output is never authorization. Mutations require a separate,
        # structured confirmation supplied by the client for this exact action.
        for tool_call in (response_msg.get("tool_calls") or [])[:5]:
            try:
                function = tool_call.get("function") or {}
                func_name = function.get("name")
                args = function.get("arguments", "{}")
                args = json.loads(args) if isinstance(args, str) else args
                if not isinstance(args, dict):
                    raise ValueError("Invalid action arguments")
                if func_name == "clear_logs":
                    if not msg.confirm_clear_logs:
                        raise ValueError("No logs were deleted. Use the dashboard Clear Logs button to confirm deletion.")
                    logger.info("User %s confirmed chat log deletion", user_id)
                    db.query(PhishingEvent).filter(PhishingEvent.user_id == user_id).delete()
                    db.query(FraudEvent).filter(FraudEvent.user_id == user_id).delete()
                    db.commit()
                    tool_results.append("Your events have been cleared successfully.")
                else:
                    from app.features.phishing.service import require_domain
                    confirmation = msg.confirmed_action
                    if confirmation is None or confirmation.action != func_name:
                        raise ValueError("No list changes were made. Use the dashboard or extension blocklist/whitelist buttons to confirm this action.")
                    if not isinstance(args.get("domain"), str):
                        raise ValueError("Invalid domain argument")
                    domain = require_domain(args["domain"])
                    if domain != require_domain(confirmation.domain):
                        raise ValueError("No list changes were made: the domain does not match your confirmation.")
                    if func_name == "add_to_whitelist":
                        set_whitelisted(db, user_id, domain)
                        tool_results.append(f"Added {domain} to whitelist.")
                    elif func_name == "add_to_blocklist":
                        set_blocklisted(db, user_id, domain)
                        tool_results.append(f"Added {domain} to blocklist.")
                    elif func_name in ("remove_from_whitelist", "remove_from_blocklist"):
                        model = UserWhitelist if func_name == "remove_from_whitelist" else UserBlocklist
                        db.query(model).filter_by(user_id=user_id, domain=domain).delete()
                        db.commit()
                        tool_results.append(f"Removed {domain} from {'whitelist' if model is UserWhitelist else 'blocklist'}.")
            except (ValueError, TypeError) as exc:
                db.rollback()
                tool_results.append(str(exc))
            except Exception:
                logger.exception("Chat action failed")
                db.rollback()
                tool_results.append("Unable to complete the action. Please try again.")
        # Report authoritative execution results, rather than allowing a model to
        # claim a denied or failed operation succeeded.
        ai_response_text = "\n\n".join(tool_results) if tool_results else response_msg.get("content")
        if not isinstance(ai_response_text, str) or not ai_response_text:
            ai_response_text = "I'm not sure how to respond to that. What would you like to do?"
        ai_response_text = ai_response_text[:8000]

    except Exception:
        ai_response_text = "⚠️ **An unexpected issue occurred while processing your request.** Please try again in a moment."
        
    ai_msg = ChatMessage(
        user_id=user_id,
        role="assistant",
        content=ai_response_text
    )
    db.add(ai_msg)
    db.commit()
    db.refresh(ai_msg)
    
    return ai_msg

@router.get("/history", response_model=ChatHistoryResponse)
def get_chat_history(
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user),
    limit: int = 100,
    offset: int = 0,
):
    user_id = current_user.id
    # Clamp limit to prevent unbounded responses
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.user_id == user_id)
        .order_by(ChatMessage.created_at.asc(), ChatMessage.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    # Sanitize legacy raw error messages so users never see ugly stack traces.
    # Use a copy to avoid mutating ORM objects (which could auto-flush to DB).
    clean_messages = []
    _error_markers = ["Groq API error", "Ollama local API error", "Client Error: Too Many Requests", "An error occurred: name 'LLM_PROVIDER'"]
    for m in messages:
        if m.content and any(err in m.content for err in _error_markers):
            # Expunge from session so attribute changes don't persist
            db.expunge(m)
            m.content = "⏳ *Baitlock AI was momentarily busy. Ready to continue.*"
        clean_messages.append(m)
    return {"messages": clean_messages}

@router.delete("/history")
def clear_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.commit()
    return {"status": "success", "message": "Chat history cleared successfully."}
