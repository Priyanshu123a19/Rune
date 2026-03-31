// ============================================================
//  Autonomous Code Review Agent — LangGraph StateGraph
//  Triggered on every GitHub push. Runs 7 nodes sequentially:
//  fetchDiff → routeReview → securityReview → performanceReview
//  → logicReview → aggregateFindings → saveReview
// ============================================================

import { StateGraph, Annotation, END, START } from "@langchain/langgraph";
import Groq from "groq-sdk";
import axios from "axios";
import { db } from "@/server/db";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "llama-3.1-8b-instant";

// ─── Finding Types ────────────────────────────────────────────────────────────

export type SecurityFinding = {
  issue: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  file: string;
  owaspCategory: string;
  recommendation: string;
};

export type PerformanceFinding = {
  issue: string;
  file: string;
  impact: "LOW" | "MEDIUM" | "HIGH";
  suggestion: string;
};

export type LogicFinding = {
  issue: string;
  file: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  suggestion: string;
};

// ─── Graph State ─────────────────────────────────────────────────────────────

const ReviewState = Annotation.Root({
  // Inputs
  projectId:     Annotation<string>(),
  commitHash:    Annotation<string>(),
  commitMessage: Annotation<string>(),
  githubUrl:     Annotation<string>(),

  // Fetched diff (truncated to 14k chars)
  diff: Annotation<string>({
    reducer: (_, b) => b,
    default: () => "",
  }),

  // Classification output from routeReview node
  changeCategories: Annotation<string[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),

  // Findings from each specialist node
  securityFindings: Annotation<SecurityFinding[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  performanceFindings: Annotation<PerformanceFinding[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),
  logicFindings: Annotation<LogicFinding[]>({
    reducer: (_, b) => b,
    default: () => [],
  }),

  // Aggregated output
  summary:         Annotation<string>({ reducer: (_, b) => b, default: () => "" }),
  overallSeverity: Annotation<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">({
    reducer: (_, b) => b,
    default: () => "LOW",
  }),
  reviewStatus: Annotation<"PROCESSING" | "COMPLETED" | "FAILED">({
    reducer: (_, b) => b,
    default: () => "PROCESSING",
  }),

  // Error propagation — if set, specialist nodes skip their LLM calls
  error: Annotation<string | undefined>({
    reducer: (_, b) => b,
    default: () => undefined,
  }),
});

type ReviewStateType = typeof ReviewState.State;

// ─── Shared Helpers ───────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGroqJSON<T>(
  systemPrompt: string,
  userContent: string,
  fallback: T,
): Promise<T> {
  await sleep(1500); // respect Groq free-tier rate limits
  try {
    const res = await groq.chat.completions.create({
      model: GROQ_MODEL,
      max_tokens: 1500,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent   },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? "";
    // Extract first JSON object or array from response
    const match = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) return JSON.parse(match[0]) as T;
    return fallback;
  } catch (err) {
    console.error("Groq JSON call error:", err);
    return fallback;
  }
}

// ─── Node 1: fetchDiff ────────────────────────────────────────────────────────
// Pulls the raw .diff from GitHub for this commit hash

async function fetchDiffNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  try {
    const { data } = await axios.get<string>(
      `${state.githubUrl}/commit/${state.commitHash}.diff`,
      {
        headers: { Accept: "application/vnd.github.v3.diff" },
        timeout: 12_000,
      },
    );
    console.log(`📄 Diff fetched for ${state.commitHash.slice(0, 7)} (${data.length} chars)`);
    return { diff: data.slice(0, 14_000) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`❌ fetchDiff failed: ${msg}`);
    return { error: `Failed to fetch diff: ${msg}`, reviewStatus: "FAILED" };
  }
}

// ─── Node 2: routeReview ──────────────────────────────────────────────────────
// Classifies the diff to determine which specialist reviewers to run

async function routeReviewNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  if (state.error || !state.diff) return { changeCategories: [] };

  const result = await callGroqJSON<{ categories: string[] }>(
    `You are a code classifier. Analyze a git diff and return ONLY a JSON object like:
{"categories": ["security", "performance", "logic"]}
Valid categories: security, performance, logic.
Include only categories where meaningful code changes exist.`,
    `Classify this diff:\n\n${state.diff.slice(0, 2500)}`,
    { categories: ["security", "performance", "logic"] },
  );

  console.log(`🔀 Review categories: ${result.categories?.join(", ")}`);
  return { changeCategories: result.categories ?? [] };
}

// ─── Node 3: securityReview ───────────────────────────────────────────────────
// OWASP Top 10 scan on the diff

async function securityReviewNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  if (state.error || !state.diff) return { securityFindings: [] };

  const result = await callGroqJSON<{ findings: SecurityFinding[] }>(
    `You are an OWASP security expert. Review git diffs for security vulnerabilities.
Return ONLY valid JSON:
{"findings": [{"issue": "...", "severity": "HIGH", "file": "path/to/file.ts", "owaspCategory": "A03:Injection", "recommendation": "..."}]}
Severity must be: LOW, MEDIUM, HIGH, or CRITICAL.
OWASP categories: A01:BrokenAccessControl, A02:CryptographicFailures, A03:Injection, A04:InsecureDesign, A05:SecurityMisconfiguration, A06:VulnerableComponents, A07:AuthFailures, A08:DataIntegrity, A09:LoggingFailures, A10:SSRF
If no vulnerabilities found, return {"findings": []}.`,
    `Review this diff for security vulnerabilities:\n\n${state.diff}`,
    { findings: [] },
  );

  console.log(`🔒 Security findings: ${result.findings?.length ?? 0}`);
  return { securityFindings: result.findings ?? [] };
}

// ─── Node 4: performanceReview ────────────────────────────────────────────────
// Identifies N+1 queries, missing indexes, expensive ops, memory leaks

async function performanceReviewNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  if (state.error || !state.diff) return { performanceFindings: [] };

  const result = await callGroqJSON<{ findings: PerformanceFinding[] }>(
    `You are a performance optimization expert reviewing code changes.
Look for: N+1 database queries, missing indexes, expensive loops, unnecessary re-renders,
memory leaks, blocking synchronous operations, missing pagination.
Return ONLY valid JSON:
{"findings": [{"issue": "...", "file": "path/to/file.ts", "impact": "HIGH", "suggestion": "..."}]}
Impact must be: LOW, MEDIUM, or HIGH.
If no issues found, return {"findings": []}.`,
    `Review this diff for performance issues:\n\n${state.diff}`,
    { findings: [] },
  );

  console.log(`⚡ Performance findings: ${result.findings?.length ?? 0}`);
  return { performanceFindings: result.findings ?? [] };
}

// ─── Node 5: logicReview ──────────────────────────────────────────────────────
// Logic bugs, missing error handling, edge cases, race conditions

async function logicReviewNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  if (state.error || !state.diff) return { logicFindings: [] };

  const result = await callGroqJSON<{ findings: LogicFinding[] }>(
    `You are a senior software engineer reviewing code for logic correctness.
Look for: logic bugs, unhandled edge cases, missing null/undefined checks,
missing error handling, incorrect conditionals, race conditions, off-by-one errors.
Return ONLY valid JSON:
{"findings": [{"issue": "...", "file": "path/to/file.ts", "severity": "MEDIUM", "suggestion": "..."}]}
Severity must be: LOW, MEDIUM, or HIGH.
If no issues found, return {"findings": []}.`,
    `Review this diff for logic bugs and missing error handling:\n\n${state.diff}`,
    { findings: [] },
  );

  console.log(`🧠 Logic findings: ${result.findings?.length ?? 0}`);
  return { logicFindings: result.findings ?? [] };
}

// ─── Node 6: aggregateFindings ────────────────────────────────────────────────
// Merges all findings, determines severity, writes executive summary

async function aggregateFindingsNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  if (state.error) {
    return {
      summary: `❌ Review could not complete: ${state.error}`,
      overallSeverity: "LOW",
      reviewStatus: "FAILED",
    };
  }

  // Calculate overall severity from all findings
  const allSeverities = [
    ...state.securityFindings.map((f) => f.severity),
    ...state.performanceFindings.map((f) => f.impact),
    ...state.logicFindings.map((f) => f.severity),
  ] as ("LOW" | "MEDIUM" | "HIGH" | "CRITICAL")[];

  let overallSeverity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (allSeverities.includes("CRITICAL"))     overallSeverity = "CRITICAL";
  else if (allSeverities.includes("HIGH"))    overallSeverity = "HIGH";
  else if (allSeverities.includes("MEDIUM"))  overallSeverity = "MEDIUM";

  const totalIssues =
    state.securityFindings.length +
    state.performanceFindings.length +
    state.logicFindings.length;

  let summary: string;

  if (totalIssues === 0) {
    summary = `✅ No significant issues found in commit \`${state.commitHash.slice(0, 7)}\`. Code looks clean.`;
  } else {
    const findingsList = [
      ...state.securityFindings.map((f) => `[SECURITY-${f.severity}] ${f.issue} (${f.file})`),
      ...state.performanceFindings.map((f) => `[PERF-${f.impact}] ${f.issue} (${f.file})`),
      ...state.logicFindings.map((f) => `[LOGIC-${f.severity}] ${f.issue} (${f.file})`),
    ].join("\n");

    try {
      await sleep(1500);
      const res = await groq.chat.completions.create({
        model: GROQ_MODEL,
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content:
              "You are a tech lead writing a concise code review summary. Be direct, professional, and actionable in 2-3 sentences.",
          },
          {
            role: "user",
            content: `Commit: "${state.commitMessage}"\n\nIssues found (${totalIssues} total):\n${findingsList}\n\nWrite a 2-3 sentence executive summary.`,
          },
        ],
      });
      summary =
        res.choices[0]?.message?.content ??
        `Found ${totalIssues} issue(s) requiring attention across security, performance, and logic checks.`;
    } catch {
      summary = `Found ${totalIssues} issue(s) requiring attention across security, performance, and logic checks.`;
    }
  }

  console.log(`📋 Aggregated: ${totalIssues} findings, severity=${overallSeverity}`);
  return { summary, overallSeverity, reviewStatus: "COMPLETED" };
}

// ─── Node 7: saveReview ───────────────────────────────────────────────────────
// Persists the completed review to the database

async function saveReviewNode(
  state: ReviewStateType,
): Promise<Partial<ReviewStateType>> {
  try {
    await db.codeReview.create({
      data: {
        projectId:          state.projectId,
        commitHash:         state.commitHash,
        commitMessage:      state.commitMessage,
        securityFindings:   state.securityFindings    as object[],
        performanceFindings: state.performanceFindings as object[],
        logicFindings:      state.logicFindings       as object[],
        summary:            state.summary,
        overallSeverity:    state.overallSeverity,
        status:             state.reviewStatus === "FAILED" ? "FAILED" : "COMPLETED",
      },
    });
    console.log(`✅ Code review saved for commit ${state.commitHash.slice(0, 7)}`);
  } catch (err) {
    console.error("Failed to save code review to DB:", err);
  }
  return {};
}

// ─── Build the StateGraph ─────────────────────────────────────────────────────

const workflow = new StateGraph(ReviewState)
  .addNode("fetchDiff",          fetchDiffNode)
  .addNode("routeReview",        routeReviewNode)
  .addNode("securityReview",     securityReviewNode)
  .addNode("performanceReview",  performanceReviewNode)
  .addNode("logicReview",        logicReviewNode)
  .addNode("aggregateFindings",  aggregateFindingsNode)
  .addNode("saveReview",         saveReviewNode)
  // Sequential edges
  .addEdge(START,               "fetchDiff")
  .addEdge("fetchDiff",         "routeReview")
  .addEdge("routeReview",       "securityReview")
  .addEdge("securityReview",    "performanceReview")
  .addEdge("performanceReview", "logicReview")
  .addEdge("logicReview",       "aggregateFindings")
  .addEdge("aggregateFindings", "saveReview")
  .addEdge("saveReview",         END);

const codeReviewApp = workflow.compile();

// ─── Public API ───────────────────────────────────────────────────────────────

export async function runCodeReviewAgent(params: {
  projectId:     string;
  commitHash:    string;
  commitMessage: string;
  githubUrl:     string;
}): Promise<void> {
  console.log(`\n🤖 Code review agent started for commit ${params.commitHash.slice(0, 7)}`);
  console.log(`   Message: "${params.commitMessage.slice(0, 60)}"`);
  await codeReviewApp.invoke({
    projectId:     params.projectId,
    commitHash:    params.commitHash,
    commitMessage: params.commitMessage,
    githubUrl:     params.githubUrl,
  });
  console.log(`🏁 Code review agent finished for commit ${params.commitHash.slice(0, 7)}\n`);
}

// Called from the GitHub webhook — reviews up to 2 commits per push
export async function triggerCodeReviewsForPush(
  projectId: string,
  githubUrl: string,
  commits: Array<{ id: string; message: string }>,
): Promise<void> {
  const toReview = commits.slice(0, 2); // cap at 2 to avoid rate limit spikes
  for (const commit of toReview) {
    try {
      await runCodeReviewAgent({
        projectId,
        githubUrl,
        commitHash:    commit.id,
        commitMessage: commit.message.split("\n")[0] ?? commit.message,
      });
    } catch (err) {
      console.error(`Code review failed for ${commit.id}:`, err);
    }
  }
}
