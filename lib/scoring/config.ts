// Quality-gate tuning for the bounty-board work review loop.
export const PASSING_SCORE = Number(process.env.JOB_PASSING_SCORE ?? 8)
export const MAX_REVIEW_ATTEMPTS = Number(process.env.JOB_MAX_REVIEW_ATTEMPTS ?? 5)

// Anthropic model used by the AI judge. Override per environment / cost.
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? 'claude-3-5-haiku-latest'
