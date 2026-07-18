# Product Context — AI Job Copilot

## Why This Exists

Job seekers spend hours per application doing repetitive, low-value tasks: copying job descriptions, manually tailoring resumes, writing cover letters from scratch, and answering the same screening questions across different platforms. This tool automates the mechanical parts while keeping the human in control of every decision.

## User Problems Solved

1. **Context switching:** Jumping between job boards, resume files, and text editors to tailor each application. The tool brings everything into a single Review UI.
2. **Writer's block:** Starting a cover letter or tailoring a professional summary from a blank page. The DeepSeek API generates a first draft based on the actual job description.
3. **Screening question fatigue:** Answering "Why do you want to work here?" for the 20th time. The LLM generates context-aware answers from the resume and profile.
4. **Resume variant confusion:** Keeping track of which resume version was sent to which company. The Application Store records the `resume_used` per application.
5. **No application history:** Losing track of where you applied, when, and what happened. The database stores every application with status tracking (draft → submitted → interview → offer).
6. **Form-filling tedium:** Copy-pasting answers from a document into web forms, one field at a time. The extension fills all fields in one click (but never submits).

## User Experience Goals

- **Fast:** From scraping a job posting to seeing generated content should take <30 seconds (dominated by DeepSeek API latency).
- **Trustworthy:** Every AI-generated answer shows a confidence tier (high/medium/low). Red-flagged answers demand review before use.
- **Safe:** The tool fills fields only. The user always clicks Submit. There is no auto-apply.
- **Transparent:** Token usage and cost are shown per generation so the user always knows what they're spending.
- **Portable:** Everything runs locally via Docker Compose. No cloud dependencies except the DeepSeek API.

## The Workflow

```
Find job posting → Click "Scrape & Tailor" → Review AI-generated content → Edit as needed →
Click "Fill Form" → Review filled form → Click Submit (manually) → Application saved to DB