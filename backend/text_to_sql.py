from __future__ import annotations

import json
import os
import re
import sqlite3
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import errors as genai_errors
from google.genai import types

BASE_DIR = Path(__file__).resolve().parent
CANDIDATE_DB_PATHS = [
    BASE_DIR / "vendas_ficticias.db",
    BASE_DIR.parent / "vendas_ficticias.db",
]
FORBIDDEN_SQL_KEYWORDS = (
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "truncate",
    "create",
    "replace",
    "attach",
    "detach",
    "pragma",
)
MUTATING_INTENT_PATTERNS = [
    r"\bupdat\w*\b",
    r"\bdelet\w*\b",
    r"\bdrop\w*\b",
    r"\balter\w*\b",
    r"\btruncat\w*\b",
    r"\binsert\w*\b",
    r"\bcreat\w*\b",
    r"\bapag\w*\b",
    r"\bdelet\w*\b",
    r"\bremov\w*\b",
    r"\balter\w*\b",
    r"\batualiz\w*\b",
    r"\binser\w*\b",
    r"\bmodific\w*\b",
]


def _resolve_db_path() -> Path:
    for path in CANDIDATE_DB_PATHS:
        if path.exists():
            return path
    raise ValueError("Arquivo de banco vendas_ficticias.db nao foi encontrado.")


def _read_schema(db_path: Path) -> str:
    with sqlite3.connect(db_path) as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT sql
            FROM sqlite_master
            WHERE type='table'
              AND name NOT LIKE 'sqlite_%'
              AND sql IS NOT NULL
            ORDER BY name
            """
        )
        rows = cur.fetchall()

    schema = "\n\n".join(row[0].strip() for row in rows)
    if not schema:
        raise ValueError("Nenhuma tabela de usuario foi encontrada no schema do SQLite.")
    return schema


def _configure_client() -> tuple[genai.Client, str]:
    load_dotenv(BASE_DIR / ".env")
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    configured_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()

    if not api_key:
        raise RuntimeError("Variavel GEMINI_API_KEY ausente em backend/.env")

    client = genai.Client(api_key=api_key)

    available_models: set[str] = set()
    for model in client.models.list():
        methods = set(getattr(model, "supported_actions", []) or [])
        if "generateContent" in methods:
            name = getattr(model, "name", "")
            if name.startswith("models/"):
                available_models.add(name.replace("models/", "", 1))

    preferred_order = [
        configured_model.replace("models/", "", 1),
        "gemini-3-flash-preview",
        "gemini-3-pro-preview",
        "gemini-1.5-flash",
        "gemini-2.0-flash",
        "gemini-2.5-flash",
        "gemini-flash-latest",
    ]

    for candidate in preferred_order:
        if candidate in available_models:
            return client, candidate

    flash_candidates = sorted(name for name in available_models if "flash" in name)
    if flash_candidates:
        return client, flash_candidates[0]

    if available_models:
        return client, sorted(available_models)[0]

    raise RuntimeError("Nenhum modelo Gemini com suporte a generateContent foi encontrado para esta API key.")


def _ask_sql(client: genai.Client, model_name: str, question: str, schema: str) -> str:
    system_instruction = f"""
You are a SQL generator for SQLite.
Return ONLY a single SQL query.
The query must start with SELECT.
Never use INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, PRAGMA.
Do not include markdown fences.

Database schema (DDL):
{schema}
""".strip()

    response = client.models.generate_content(
        model=model_name,
        contents=question,
        config=types.GenerateContentConfig(system_instruction=system_instruction),
    )
    text = (response.text or "").strip()
    if not text:
        raise RuntimeError("O Gemini retornou uma resposta vazia para geracao de SQL.")
    return text


def _clean_sql(raw_sql: str) -> str:
    sql = raw_sql.strip()
    sql = re.sub(r"^```(?:sql)?\s*", "", sql, flags=re.IGNORECASE)
    sql = re.sub(r"\s*```$", "", sql)
    sql = sql.strip().strip("`").strip()
    sql = re.sub(r"\s+", " ", sql)
    return sql


def _validate_sql(sql: str) -> str:
    if not re.match(r"^select\b", sql, flags=re.IGNORECASE):
        raise ValueError("Apenas consultas SELECT sao permitidas.")

    lowered = sql.lower()
    if any(f" {keyword} " in f" {lowered} " for keyword in FORBIDDEN_SQL_KEYWORDS):
        raise ValueError("SQL inseguro detectado. Apenas SELECT de leitura e permitido.")

    trimmed = sql.rstrip(";").strip()
    if ";" in trimmed:
        raise ValueError("Multiplas instrucoes SQL nao sao permitidas.")

    return trimmed


def _run_select_query(db_path: Path, sql: str) -> list[dict]:
    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()

    return [dict(row) for row in rows]


def _validate_question_intent(question: str) -> None:
    lowered = question.lower()
    for pattern in MUTATING_INTENT_PATTERNS:
        if re.search(pattern, lowered):
            raise ValueError("Apenas perguntas analiticas de leitura sao permitidas.")


def _ask_summary(
    client: genai.Client,
    model_name: str,
    question: str,
    sql: str,
    rows: list[dict],
) -> str:
    if not rows:
        return "Nenhum registro foi encontrado para esta pergunta."

    sample_rows = rows[:20]
    summary_system_instruction = (
        "Escreva um resumo executivo em portugues do Brasil, com 2 a 4 frases, "
        "usando apenas os dados fornecidos na entrada."
    )
    summary_input = (
        f"Pergunta: {question}\n"
        f"SQL: {sql}\n"
        f"Linhas (amostra JSON): {json.dumps(sample_rows, ensure_ascii=False)}"
    )

    response = client.models.generate_content(
        model=model_name,
        contents=summary_input,
        config=types.GenerateContentConfig(system_instruction=summary_system_instruction),
    )
    text = (response.text or "").strip()
    return text or "Nao foi possivel gerar o resumo."


def process_question(question: str) -> dict:
    cleaned_question = question.strip()
    if not cleaned_question:
        raise ValueError("A pergunta nao pode estar vazia.")
    _validate_question_intent(cleaned_question)

    db_path = _resolve_db_path()
    schema = _read_schema(db_path)
    client, model_name = _configure_client()

    try:
        raw_sql = _ask_sql(client, model_name, cleaned_question, schema)
    except genai_errors.APIError as exc:
        raise RuntimeError(f"Falha na requisicao ao Gemini durante a geracao do SQL: {exc}") from exc

    cleaned_sql = _clean_sql(raw_sql)
    safe_sql = _validate_sql(cleaned_sql)
    rows = _run_select_query(db_path, safe_sql)
    try:
        summary = _ask_summary(client, model_name, cleaned_question, safe_sql, rows)
    except genai_errors.APIError:
        summary = "Nao foi possivel gerar o resumo neste momento."

    return {
        "query": safe_sql,
        "data": rows,
        "summary": summary,
    }
