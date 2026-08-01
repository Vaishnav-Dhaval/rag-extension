# Git Commit Message Standard

## Before Making a Commit

**Always show the generated commit message and ask me to review it before considering it final. Do not assume approval. Wait for my confirmation or requested edits before proceeding.**

## Format

```text
<type>(<module>): <short summary>

What
- Describe the changes made.

Why
- Explain the reason or motivation for the changes.

How
- Summarize the implementation approach or key technical decisions.

Not Covered
- List known limitations, edge cases, or intentionally excluded functionality.

Risks
- Mention any potential side effects, assumptions, or areas that require monitoring.
```

## Guidelines

- Keep subject line concise (≤72 chars).
- Use imperative verbs (add, fix, refactor, improve, **init**).
- Keep bullets short and focused.
- Be specific, not generic.
- Do **NOT** omit sections. Use `None` if not applicable.
- An unfamiliar developer should understand the purpose, implementation, limitations, and impact from the commit message alone.
- Document intent and impact, not just code changes.
- **Before finalizing a commit, always present the commit message and ask for my review/approval. Revise it if I request changes.**
- **Never add `Co-authored-by:` trailers or any attribution to AI assistants, LLMs, or automated tools in commit messages.**

## Types

| Type       | Meaning                               |
| :--------- | :------------------------------------ |
| `feat`     | New feature                           |
| `fix`      | Bug fix                               |
| `refactor` | Code restructuring                    |
| `perf`     | Performance improvement               |
| `docs`     | Documentation                         |
| `test`     | Tests                                 |
| `style`    | Formatting only                       |
| `build`    | Build changes                         |
| `ci`       | CI/CD                                 |
| `chore`    | Maintenance                           |
| `security` | Security fixes                        |
| `deps`     | Dependency updates                    |
| `revert`   | Revert a commit                       |
| `init`     | Initial project setup or first commit |

## Example

```text
feat(auth): add fabric collection auth flow

What
- Implement OAuth 2.0 login for fabric collections.
- Add token refresh and storage.
- Create AuthContext for app-wide access.

Why
- Mobile users need seamless authentication to access fabric APIs.
- Token refresh prevents session expiry during workflows.

How
- Use Firebase Auth for sign-in.
- Store tokens in secure device storage (expo-secure-store).
- Wrap the app root with AuthContext to provide authentication state.

Not Covered
- Logout flow (planned next sprint).
- Biometric authentication (future enhancement).
- SSO integration (out of scope).

Risks
- Token expiry during uploads could interrupt long transfers.
- AuthContext re-renders on token refresh (monitor performance).
```
