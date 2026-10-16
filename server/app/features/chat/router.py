from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api.deps import get_db, get_optional_user
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
    current_user: User = Depends(get_optional_user)
):
    user_id = current_user.id if current_user else 1
    # Save user message
    user_msg = ChatMessage(user_id=user_id, role="user", content=msg.content)
    db.add(user_msg)
    db.commit()
    
    # Fetch history
    history = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc()).limit(10).all()
    
    messages = [{"role": "system", "content": "You are Baitlock, an agentic cybersecurity assistant. You can manage blocklists, whitelists, and clear logs using tools. Always confirm what action you took."}]
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
                            db.query(PhishingEvent).delete()
                            db.query(FraudEvent).delete()
                            db.commit()
                            tool_result = "All events cleared successfully."
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
        
    except Exception as e:
        ai_response_text = f"An error occurred: {str(e)}"
        
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
    current_user: User = Depends(get_optional_user)
):
    user_id = current_user.id if current_user else 1
    messages = db.query(ChatMessage).filter(ChatMessage.user_id == user_id).order_by(ChatMessage.created_at.asc()).all()
    return {"messages": messages}
