import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CANDIDATE_DB_PATHS = [
    BASE_DIR / "vendas_ficticias.db",
    BASE_DIR.parent / "vendas_ficticias.db",
]


def resolve_db_path() -> Path | None:
    for path in CANDIDATE_DB_PATHS:
        if path.exists():
            return path
    return None


def get_schema(db_path: Path) -> str:
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

    return "\n\n".join(row[0].strip() for row in rows)


def main() -> None:
    db_path = resolve_db_path()
    if db_path is None:
        expected = "\n".join(str(p) for p in CANDIDATE_DB_PATHS)
        print("Banco nao encontrado nos caminhos esperados:")
        print(expected)
        print("Execute primeiro: python database.py")
        return

    schema = get_schema(db_path)
    if not schema:
        print("Nenhuma tabela encontrada no banco.")
        return

    print(f"Conexao OK em: {db_path}")
    print("Schema lido com sucesso:\n")
    print(schema)


if __name__ == "__main__":
    main()
