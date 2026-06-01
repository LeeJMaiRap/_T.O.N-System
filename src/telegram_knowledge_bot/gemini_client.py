from __future__ import annotations

from google import genai
from google.genai import types


SYSTEM_PROMPT = """Bạn là bot hỏi đáp nội bộ. Chỉ trả lời dựa trên CONTEXT được cung cấp.
Nếu không thấy thông tin trong CONTEXT, trả lời: "Tôi không tìm thấy thông tin này trong tài liệu đã nạp."
Không bịa, không suy diễn ngoài tài liệu. Trả lời tiếng Việt, ngắn gọn, có bullet khi hữu ích.
Luôn thêm mục "Nguồn" nếu có source trong context.
"""


class GeminiAnswerer:
    def __init__(self, api_key: str, model: str) -> None:
        self.client = genai.Client(api_key=api_key)
        self.model = model

    async def answer(self, question: str, context: str, sources: list[str]) -> str:
        if not context.strip():
            return "Tôi không tìm thấy thông tin này trong tài liệu đã nạp."

        prompt = f"""CONTEXT:
{context}

QUESTION:
{question}

SOURCES:
{chr(10).join(sources)}
"""
        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.1,
                max_output_tokens=1200,
            ),
        )
        return (response.text or "Tôi không tìm thấy thông tin này trong tài liệu đã nạp.").strip()
