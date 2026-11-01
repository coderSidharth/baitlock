from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api.deps import get_db, get_current_user
from app.features.auth.models import User
from app.features.chat.models import ChatMessage
from app.features.chat.schemas import ChatMessageCreate, ChatMessageOut, ChatHistoryResponse
from app.integrations.llm import chat_with_llm

router = APIRouter()

from app.features.phishing.models import UserWhitelist, UserBlocklist, PhishingEvent
from app.features.fraud.models import FraudEvent
import json

@router.post("", response_model=ChatMessageOut)
def send_chat_message(
    msg: ChatMessageCreate, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    # Save user message
    user_msg = ChatMessage(user_id=user_id, role="user", content=msg.content)
    db.add(user_msg)
    db.commit()
    
    # Fetch recent clean messages in chronological order to save tokens
    recent_history = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.desc()).limit(10).all()
    history = [h for h in reversed(recent_history) if not any(err in (h.content or "") for err in ["Groq API error", "Ollama local API", "Client Error:"])]
    
    # Gather live telemetry for assistant context
    active_blocks = [b.domain for b in db.query(UserBlocklist).filter((UserBlocklist.user_id == user_id) | (UserBlocklist.user_id.is_(None))).all()]
    active_whites = [w.domain for w in db.query(UserWhitelist).filter((UserWhitelist.user_id == user_id) | (UserWhitelist.user_id.is_(None))).all()]
    all_scores = [p[0] for p in db.query(PhishingEvent.final_score).all()] + [f[0] for f in db.query(FraudEvent.final_score).all()]
    avg_score = round(sum(all_scores) / len(all_scores), 1) if all_scores else 100
    total_events = len(all_scores)
    critical_count = db.query(PhishingEvent).filter(PhishingEvent.verdict.like("%CRITICAL%")).count() + db.query(FraudEvent).filter(FraudEvent.verdict.like("%FRAUD%")).count()

    system_prompt = f"""You are Baitlock AI, an expert agentic cybersecurity shield and assistant.
You have real-time access to the user's security posture and threat intelligence telemetry.

LIVE SYSTEM POSTURE:
- Overall Security Score: {avg_score}/100
- Total Monitored Events: {total_events}
- High & Critical Threats Intercepted: {critical_count}
- Active Blocklist ({len(active_blocks)} domains): {', '.join(active_blocks) if active_blocks else 'None'}
- Active Whitelist ({len(active_whites)} domains): {', '.join(active_whites) if active_whites else 'None'}

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
        
        tools_executed = False
        
        # Loop for tool calls (up to 3 times to prevent infinite loops)
        for _ in range(3):
            if response_msg.get("tool_calls"):
                tools_executed = True
                messages.append(response_msg)
                
                for tool_call in response_msg["tool_calls"]:
                    func_name = tool_call["function"]["name"]
                    args = json.loads(tool_call["function"]["arguments"])
                    tool_result = ""
                    
                    try:
                        if func_name == "add_to_whitelist":
                            domain = args.get("domain")
                            if not db.query(UserWhitelist).filter_by(user_id=user_id, domain=domain).first():
                                db.add(UserWhitelist(user_id=user_id, domain=domain))
                                db.commit()
                            tool_result = f"Added {domain} to whitelist."
                        
                        elif func_name == "remove_from_whitelist":
                            domain = args.get("domain")
                            db.query(UserWhitelist).filter_by(user_id=user_id, domain=domain).delete()
                            db.commit()
                            tool_result = f"Removed {domain} from whitelist."
                            
                        elif func_name == "add_to_blocklist":
                            domain = args.get("domain")
                            if not db.query(UserBlocklist).filter_by(user_id=user_id, domain=domain).first():
                                db.add(UserBlocklist(user_id=user_id, domain=domain))
                                db.commit()
                            tool_result = f"Added {domain} to explicit blocklist."
                            
                        elif func_name == "remove_from_blocklist":
                            domain = args.get("domain")
                            db.query(UserBlocklist).filter_by(user_id=user_id, domain=domain).delete()
                            db.commit()
                            tool_result = f"Removed {domain} from blocklist."
                            
                        elif func_name == "clear_logs":
                            db.query(PhishingEvent).filter(PhishingEvent.user_id == user_id).delete()
                            db.query(FraudEvent).filter(FraudEvent.user_id == user_id).delete()
                            db.commit()
                            tool_result = "Your events have been cleared successfully."
                        else:
                            tool_result = "Unknown function."
                    except Exception as e:
                        tool_result = f"Error executing tool: {e}"
                        db.rollback()
                        
                    messages.append({
                        "tool_call_id": tool_call["id"],
                        "role": "tool",
                        "name": func_name,
                        "content": tool_result
                    })
                
                response_msg = chat_with_llm(messages)
            else:
                break
                
        ai_response_text = response_msg.get("content")
        if not ai_response_text:
            if tools_executed:
                ai_response_text = "I have successfully executed the requested actions."
            else:
                ai_response_text = "I'm not sure how to respond to that. What would you like to do?"
        
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
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    messages = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc()).all()
    # Sanitize legacy raw error messages so users never see ugly stack traces
    clean_messages = []
    for m in messages:
        if m.content and any(err in m.content for err in ["Groq API error", "Ollama local API error", "Client Error: Too Many Requests", "An error occurred: name 'LLM_PROVIDER'"]):
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
