"use client";

import axios from "axios";
import {
  BarChart3,
  LoaderCircle,
  MessageSquareText,
  Send,
  Table2,
  TrendingUp,
} from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Footer } from "../components/Footer";
import { Navbar } from "../components/Navbar";

type DataRow = Record<string, string | number | null>;

type ChatResponse = {
  query: string;
  data: DataRow[];
  summary: string;
};

type ChatMessage = {
  id: string;
  question: string;
  query?: string;
  summary?: string;
  error?: string;
};

type ChartKind = "bar" | "line" | "pie" | "none";

type ChartConfig = {
  kind: ChartKind;
  categoryKey?: string;
  valueKey?: string;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "http://127.0.0.1:8000";
const PAGE_SIZE = 10;
const CHART_COLORS = ["#0d3b66", "#e07a5f", "#2a9d8f", "#e9c46a", "#457b9d", "#8d99ae"];

const isNumericValue = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isDateLike = (value: unknown): boolean => {
  if (typeof value !== "string") {
    return false;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) === false;
};

const inferChartConfig = (rows: DataRow[]): ChartConfig => {
  if (!rows.length) {
    return { kind: "none" };
  }

  const keys = Object.keys(rows[0]);
  const numericKeys = keys.filter((key) => rows.some((row) => isNumericValue(row[key])));
  if (!numericKeys.length) {
    return { kind: "none" };
  }

  const valueKey = numericKeys[0];
  const nonNumericKeys = keys.filter((key) => key !== valueKey);
  const dateKey = nonNumericKeys.find((key) => rows.some((row) => isDateLike(row[key])));

  if (dateKey) {
    return { kind: "line", categoryKey: dateKey, valueKey };
  }

  const categoryKey = nonNumericKeys[0];
  if (categoryKey) {
    const uniqueCategories = new Set(rows.map((row) => String(row[categoryKey] ?? "Sem categoria")));
    if (uniqueCategories.size <= 6) {
      return { kind: "pie", categoryKey, valueKey };
    }
    return { kind: "bar", categoryKey, valueKey };
  }

  return { kind: "none" };
};

const formatValue = (value: unknown): string => {
  if (typeof value === "number") {
    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (value === null || value === undefined) {
    return "-";
  }
  return String(value);
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const columns = useMemo(() => (result?.data.length ? Object.keys(result.data[0]) : []), [result]);
  const totalPages = useMemo(
    () => (result?.data.length ? Math.ceil(result.data.length / PAGE_SIZE) : 1),
    [result],
  );

  const currentRows = useMemo(() => {
    if (!result?.data.length) {
      return [];
    }

    const start = (page - 1) * PAGE_SIZE;
    return result.data.slice(start, start + PAGE_SIZE);
  }, [page, result]);

  const chartConfig = useMemo(() => inferChartConfig(result?.data ?? []), [result]);

  const chartData = useMemo(() => {
    if (!result?.data.length || !chartConfig.categoryKey || !chartConfig.valueKey) {
      return [];
    }

    return result.data.map((row) => ({
      category: String(row[chartConfig.categoryKey!] ?? "Sem categoria"),
      value: Number(row[chartConfig.valueKey!] ?? 0),
    }));
  }, [chartConfig, result]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuestion = question.trim();
    if (!normalizedQuestion || loading) {
      return;
    }

    setLoading(true);
    setPage(1);
    setApiError(null);

    try {
      const response = await axios.post<ChatResponse>(`${API_BASE_URL}/api/chat`, {
        question: normalizedQuestion,
      });

      const payload = response.data;
      setResult(payload);
      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          question: normalizedQuestion,
          query: payload.query,
          summary: payload.summary,
        },
        ...prev,
      ]);
      setApiError(null);
      setQuestion("");
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || "Falha ao consultar o backend."
        : "Falha inesperada ao executar a consulta.";
      setApiError(message);

      setMessages((prev) => [
        {
          id: crypto.randomUUID(),
          question: normalizedQuestion,
          error: message,
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-5 p-4 md:p-6">
      <Navbar />

      <main className="flex flex-1 flex-col gap-5">
        <header className="rounded-2xl border border-[#d7e0e8] bg-white px-5 py-4 shadow-sm">
          <h2 className="text-xl font-semibold text-[var(--areco-ink)]">Painel de Consulta</h2>
          <p className="mt-1 text-sm text-[var(--areco-muted)]">
            Envie perguntas em linguagem natural para gerar SQL seguro e visualizar os resultados.
          </p>
        </header>

        {apiError && (
          <section className="rounded-2xl border border-[#f2b6a4] bg-[#fff2ed] p-4 text-sm text-[#8a361f] shadow-sm">
            <h3 className="font-semibold">Erro da consulta</h3>
            <p className="mt-1">{apiError}</p>
          </section>
        )}

        <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="space-y-5 rounded-2xl border border-[var(--areco-line)] bg-white p-5 shadow-sm">
            <section aria-labelledby="form-titulo" className="space-y-3">
              <div className="flex items-center gap-2 text-[var(--areco-ink)]">
                <MessageSquareText size={18} />
                <h2 id="form-titulo" className="text-lg font-semibold">
                  Entrada da Pergunta
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <label htmlFor="question" className="text-sm font-medium text-[var(--areco-text)]">
                  Digite sua pergunta
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  rows={4}
                  placeholder="Ex: Qual foi o faturamento por produto no periodo?"
                  className="w-full rounded-xl border border-[#ccd8e3] bg-[#fbfdff] px-3 py-2 text-sm outline-none transition focus:border-[var(--areco-ink)] focus:ring-2 focus:ring-[#0d3b6633]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--areco-gold)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  {loading ? "Processando..." : "Enviar pergunta"}
                </button>
              </form>
            </section>

            <section aria-labelledby="historico-titulo" className="space-y-3">
              <h2 id="historico-titulo" className="text-sm font-semibold text-[var(--areco-muted)]">
                Historico
              </h2>
              <div className="max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {messages.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#c8d4df] bg-[#f8fbff] p-3 text-xs text-[var(--areco-muted)]">
                    Nenhuma interacao registrada ainda.
                  </p>
                ) : (
                  messages.map((message) => (
                    <article key={message.id} className="rounded-lg border border-[#dbe4ec] bg-[#fbfdff] p-3 text-xs">
                      <h3 className="font-semibold text-[var(--areco-ink)]">Pergunta</h3>
                      <p className="mt-1 text-[var(--areco-text)]">{message.question}</p>
                      {message.error ? (
                        <p className="mt-2 rounded-md bg-[#ffe7df] p-2 text-[#8a361f]">{message.error}</p>
                      ) : (
                        <>
                          <h3 className="mt-2 font-semibold text-[var(--areco-ink)]">Resumo</h3>
                          <p className="mt-1 text-[var(--areco-text)]">{message.summary}</p>
                        </>
                      )}
                    </article>
                  ))
                )}
              </div>
            </section>
          </aside>

          <div className="space-y-5">
            <section aria-labelledby="visualizacao-titulo" className="rounded-2xl border border-[var(--areco-line)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-[var(--areco-ink)]">
                <BarChart3 size={18} />
                <h2 id="visualizacao-titulo" className="text-lg font-semibold">
                  Visualizacao
                </h2>
              </div>

              {!result?.data.length ? (
                <p className="rounded-lg border border-dashed border-[#c8d4df] bg-[#f8fbff] p-4 text-sm text-[var(--areco-muted)]">
                  Execute uma consulta para renderizar o grafico automaticamente.
                </p>
              ) : chartConfig.kind === "none" ? (
                <p className="rounded-lg border border-dashed border-[#c8d4df] bg-[#f8fbff] p-4 text-sm text-[var(--areco-muted)]">
                  Nao foi possivel identificar um tipo de grafico para este formato de dados.
                </p>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {chartConfig.kind === "bar" ? (
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ee" />
                        <XAxis dataKey="category" stroke="#4e6f85" fontSize={12} />
                        <YAxis stroke="#4e6f85" fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" name={chartConfig.valueKey} radius={[6, 6, 0, 0]} fill="#0d3b66" />
                      </BarChart>
                    ) : chartConfig.kind === "line" ? (
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e1e8ee" />
                        <XAxis dataKey="category" stroke="#4e6f85" fontSize={12} />
                        <YAxis stroke="#4e6f85" fontSize={12} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name={chartConfig.valueKey}
                          stroke="#e07a5f"
                          strokeWidth={3}
                          dot={{ r: 3 }}
                        />
                      </LineChart>
                    ) : (
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie data={chartData.slice(0, 8)} dataKey="value" nameKey="category" outerRadius={110} label>
                          {chartData.slice(0, 8).map((entry, index) => (
                            <Cell key={`${entry.category}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            <section aria-labelledby="resultados-titulo" className="rounded-2xl border border-[var(--areco-line)] bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[var(--areco-ink)]">
                  <Table2 size={18} />
                  <h2 id="resultados-titulo" className="text-lg font-semibold">
                    Resultados da Consulta
                  </h2>
                </div>
                <p className="text-xs text-[var(--areco-muted)]">
                  {result ? `${result.data.length} linhas retornadas` : "Sem resultados"}
                </p>
              </div>

              {result?.query && (
                <article className="mb-4 rounded-lg border border-[#d9e3ec] bg-[#f7fbff] p-3 text-xs">
                  <h3 className="mb-1 flex items-center gap-2 font-semibold text-[var(--areco-ink)]">
                    <TrendingUp size={14} /> SQL gerado
                  </h3>
                  <code className="font-mono text-[11px] text-[#243f55]">{result.query}</code>
                </article>
              )}

              {!result?.data.length ? (
                <p className="rounded-lg border border-dashed border-[#c8d4df] bg-[#f8fbff] p-4 text-sm text-[var(--areco-muted)]">
                  O resultado da consulta aparecera aqui.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border border-[#dde6ee]">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-[#0d3b66] text-white">
                        <tr>
                          {columns.map((column) => (
                            <th key={column} className="px-3 py-2 font-semibold">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentRows.map((row, rowIndex) => (
                          <tr key={`${rowIndex}-${Object.values(row).join("-")}`} className="even:bg-[#f7fbff]">
                            {columns.map((column) => (
                              <td key={column} className="border-t border-[#edf2f7] px-3 py-2">
                                {formatValue(row[column])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-xs text-[var(--areco-muted)]">
                    <p>
                      Pagina {page} de {totalPages}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                        className="rounded-md border border-[#c6d4df] px-3 py-1 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <button
                        onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                        disabled={page >= totalPages}
                        className="rounded-md border border-[#c6d4df] px-3 py-1 disabled:opacity-50"
                      >
                        Proxima
                      </button>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
