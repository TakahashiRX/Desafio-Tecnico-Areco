# Desafio Tecnico Areco - Text-to-SQL com IA Generativa

## Objetivo
Disponibilizar uma aplicacao full-stack capaz de:
- receber perguntas em linguagem natural
- gerar SQL com IA (Gemini)
- executar consultas no SQLite
- apresentar os resultados em tabela e graficos no frontend

## Arquitetura da Solucao
- `backend/`: API FastAPI, integracao Gemini, validacoes de seguranca SQL
- `frontend/`: Next.js com interface de consulta, historico, tabela e visualizacao
- `vendas_ficticias.db`: banco SQLite utilizado nas consultas

## Requisitos de Ambiente
- Python 3.11+
- Node.js 20+
- npm 10+
- API Key Gemini com quota ativa

## Configuracao do Ambiente

### Backend
No PowerShell, a partir da raiz do projeto:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### Frontend
Em outro terminal:

```powershell
cd frontend
npm install
```

## Instalacao de Dependencias

### Backend (`backend/requirements.txt`)
- `fastapi`
- `uvicorn`
- `python-dotenv`
- `google-genai`
- `pandas`
- `httpx`

### Frontend (`frontend/package.json`)
- `next`
- `react`
- `axios`
- `recharts`
- `lucide-react`

## Configuracao das Chaves de API
Criar o arquivo `backend/.env` com:

```env
GEMINI_API_KEY=SUA_CHAVE_GEMINI
GEMINI_MODEL=gemini-3-flash-preview
```

## Execucao da Aplicacao

### 1. Preparar banco de dados
Na pasta `backend`:

```powershell
python database.py
python db_utils.py
```

### 2. Iniciar backend
Na pasta `backend`:

```powershell
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Iniciar frontend
Na pasta `frontend`:

```powershell
npm run dev
```

### 4. Acessos
- Frontend: `http://localhost:3000`

## Regras de Seguranca (Backend)
- apenas consultas iniciadas por `SELECT` sao permitidas
- comandos destrutivos sao bloqueados (`DROP`, `DELETE`, `UPDATE`, `INSERT`, etc.)
- multiplas instrucoes SQL na mesma requisicao sao bloqueadas
- perguntas com intencao de alteracao de dados sao recusadas
- mensagens de erro retornam em PT-BR para exibicao no frontend

## Testes e Validacao

### Frontend
```powershell
cd frontend
npm run lint
```

### Backend
```powershell
cd backend
python -m py_compile main.py text_to_sql.py db_utils.py database.py
```

## Troubleshooting - Quota da API Gemini
Erro tipico: `RESOURCE_EXHAUSTED` ou `limit: 0`.

Causa:
- a API Key esta sem quota/billing ativo para `generate_content`.

