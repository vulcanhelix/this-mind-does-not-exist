---
name: "System Design Decomposition"
domain: engineering
complexity: complex
methodology: analytical
keywords: [system design, architecture, scalability, distributed, requirements, tradeoffs, infrastructure]
description: "Template for designing complex software systems. Covers requirements, high-level design, component deep-dives, tradeoffs, and failure modes."
---

## When to Use
- System design interview questions
- Designing new software architectures
- Evaluating architectural decisions
- Writing technical design documents
- Infrastructure planning

## Steps

### Step 1: Requirements Clarification
**Functional Requirements:**
- What does the system need to do?
- Who are the users?
- What are the core use cases?

**Non-Functional Requirements:**
- Scale: How many users/requests?
- Latency: What's the SLA?
- Availability: What's the uptime target?
- Consistency: Strong or eventual?
- Durability: Can we lose data?

### Step 2: Back-of-Envelope Estimation
- Traffic: X requests/sec
- Storage: Y GB/day
- Bandwidth: Z MB/s
- Memory: W GB needed

### Step 3: High-Level Design
Draw the system diagram with major components:
- Client → Load Balancer → API Gateway → Services → Database
- Identify the data flow
- Identify the critical path

### Step 4: Component Deep Dive
For each major component:
- **Purpose:** What does it do?
- **Technology choice:** What tool/service and why?
- **Data model:** What's the schema?
- **API contract:** What endpoints/interfaces?
- **Scaling strategy:** How does it handle growth?

### Step 5: Tradeoff Analysis
For each major decision:
| Option A | Option B |
|---|---|
| Pros | Pros |
| Cons | Cons |
| Best when... | Best when... |

### Step 6: Failure Modes & Mitigations
- What can go wrong?
- How do you detect it?
- How do you recover?
- What's the blast radius?

### Step 7: Future Considerations
- How would you evolve this design?
- What would you change at 10x scale?
- What technical debt are you accepting?

## Verification Checklist
- [ ] Are requirements clearly defined?
- [ ] Does the design meet all non-functional requirements?
- [ ] Are tradeoffs explicitly stated?
- [ ] Are failure modes addressed?
- [ ] Is the design horizontally scalable?
- [ ] Is the data model normalized appropriately?
