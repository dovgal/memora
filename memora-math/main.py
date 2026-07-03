# memora-math: CAS-микросервис (SymPy) для Memora.
#
# Зачем отдельный сервис: символьную математику и проверку арифметики нельзя
# доверять LLM (subject-packs-spec §3), а тянуть SymPy в Rust-образ нельзя.
# Разворачивается вторым сервисом на Railway рядом с memora-api.
#
# Эндпоинты:
#   GET  /health              — проверка живости
#   POST /check-equivalence   — эквивалентны ли два выражения (simplify(a-b) == 0)
#   POST /evaluate            — численное значение выражения (верификация ответов LLM)
#
# Аутентификация: Bearer-токен MATH_SERVICE_TOKEN (внутренний сервис, наружу не светить).

import os
import re
from typing import Optional

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from sympy import N, simplify
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication_application,
    parse_expr,
    standard_transformations,
)

app = FastAPI(title="memora-math")

TOKEN = os.environ.get("MATH_SERVICE_TOKEN", "")

# Только арифметика/алгебра: буквы-переменные, числа, операции, скобки.
# Никаких подчёркиваний/атрибутов — parse_expr исполняет python-выражения,
# поэтому вход жёстко фильтруем ДО парсинга.
ALLOWED = re.compile(r"^[0-9a-zA-Z+\-*/^().,\s]*$")
TRANSFORMS = standard_transformations + (implicit_multiplication_application, convert_xor)
MAX_LEN = 200


def parse(raw: str):
    s = (raw or "").strip().replace(",", ".")
    if not s or len(s) > MAX_LEN or not ALLOWED.match(s):
        raise HTTPException(status_code=400, detail="invalid expression")
    try:
        return parse_expr(s, transformations=TRANSFORMS, evaluate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="unparseable expression")


def auth(authorization: Optional[str]):
    if TOKEN and authorization != f"Bearer {TOKEN}":
        raise HTTPException(status_code=401, detail="unauthorized")


class EquivalenceIn(BaseModel):
    expected: str
    given: str


class EvaluateIn(BaseModel):
    expression: str


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/check-equivalence")
def check_equivalence(body: EquivalenceIn, authorization: Optional[str] = Header(None)):
    auth(authorization)
    a = parse(body.expected)
    b = parse(body.given)
    try:
        equivalent = simplify(a - b) == 0
    except Exception:
        equivalent = False
    return {"equivalent": bool(equivalent)}


@app.post("/evaluate")
def evaluate(body: EvaluateIn, authorization: Optional[str] = Header(None)):
    auth(authorization)
    expr = parse(body.expression)
    try:
        value = float(N(expr))
    except Exception:
        raise HTTPException(status_code=400, detail="not a numeric expression")
    return {"value": value}
