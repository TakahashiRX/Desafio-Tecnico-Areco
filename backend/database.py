import sqlite3
import random
from datetime import datetime, timedelta

def gerar_dados():
    conn = sqlite3.connect('vendas_ficticias.db')
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            produto TEXT,
            valor_unidade REAL,
            quantidade INTEGER,
            total REAL,
            forma_pagamento TEXT,
            parcelado TEXT
        )
    ''')

    produtos = [
        ("Notebook Gamer", 4500.00), ("Mouse Sem Fio", 120.00), 
        ("Teclado Mecânico", 350.00), ("Monitor 4K", 2100.00),
        ("Headset 7.1", 280.00), ("Cadeira Ergonômica", 1200.00),
        ("Webcam Full HD", 320.00), ("SSD 1TB", 450.00)
    ]
    
    formas_pagamento = ["Pix", "Cartão de Crédito", "Boleto", "Cartão de Débito"]
    
    data_inicial = datetime(2025, 1, 1)
    
    for _ in range(150):
        dias_aleatorios = random.randint(0, 410)
        data_venda = (data_inicial + timedelta(days=dias_aleatorios)).strftime('%Y-%m-%d')
        
        prod_nome, prod_preco = random.choice(produtos)
        qtd = random.randint(1, 5)
        valor_total = round(prod_preco * qtd, 2)
        
        pagamento = random.choice(formas_pagamento)
        
        is_parcelado = "Sim" if pagamento == "Cartão de Crédito" and random.random() > 0.3 else "Não"
        
        cursor.execute('''
            INSERT INTO vendas (data, produto, valor_unidade, quantidade, total, forma_pagamento, parcelado)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (data_venda, prod_nome, prod_preco, qtd, valor_total, pagamento, is_parcelado))

    conn.commit()
    conn.close()
    print("Arquivo 'vendas_ficticias.db' gerado com sucesso!")

if __name__ == "__main__":
    gerar_dados()