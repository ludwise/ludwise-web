---
ste-prose: descriptive
---

# Triage labels

The skills speak in terms of five canonical triage roles. This file maps each
role to the label string that this repository actually uses.

| Role in mattpocock/skills | Label in this tracker | Meaning                                     |
| ------------------------- | --------------------- | ------------------------------------------- |
| `needs-triage`            | `needs-triage`        | A maintainer must evaluate this issue       |
| `needs-info`              | `needs-info`          | The issue waits for more information        |
| `ready-for-agent`         | `ready-for-agent`     | Fully specified, and ready for an AFK agent |
| `ready-for-human`         | `ready-for-human`     | A person must implement this issue          |
| `wontfix`                 | `wontfix`             | LUDWISE will not action this issue          |

When a skill names a role, apply the label string from the right-hand column.

## Labels that must exist first

`ready-for-agent` and `wontfix` already exist here. A skill applies each one
rather than creating a duplicate.

`needs-triage`, `needs-info` and `ready-for-human` did not exist. Create each one
before the first `/triage` run:

```sh
gh label create "needs-triage"    --description "A maintainer must evaluate this issue" --color FBCA04
gh label create "needs-info"      --description "The issue waits for more information"  --color D876E3
gh label create "ready-for-human" --description "A person must implement this issue"    --color 0E8A16
```

The backend repository maps `needs-info` to `status: needs-info` instead, because
that label already exists there. Each repository holds its own mapping.

Edit the right-hand column if the vocabulary changes.
