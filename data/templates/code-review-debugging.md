---
name: "Code Review & Debugging"
domain: engineering
complexity: moderate
methodology: systematic
keywords: [debug, code review, bug, error, testing, root cause, fix]
description: "Template for systematic code debugging and review. Covers bug reproduction, root cause analysis, fix verification, and prevention."
---

## Steps

### Step 1: Reproduce & Understand
- What is the expected behavior?
- What is the actual behavior?
- What are the exact steps to reproduce?
- What environment/configuration is relevant?

### Step 2: Isolate the Problem
- Narrow down: Which file, function, line?
- Simplify: What is the minimal reproduction?
- Instrument: Add logging, breakpoints, assertions

### Step 3: Root Cause Analysis
- What is the underlying cause (not just the symptom)?
- Why did this happen? (5 Whys technique)
- Is this a pattern that might exist elsewhere?

### Step 4: Design the Fix
- What is the minimal correct fix?
- Are there side effects?
- Does this fix all related instances?
- What tests should be added?

### Step 5: Verify & Prevent
- Does the test pass?
- Does the fix handle edge cases?
- What can prevent this class of bug in the future?

## Verification Checklist
- [ ] Is the root cause identified (not just the symptom)?
- [ ] Is the fix minimal and correct?
- [ ] Are edge cases handled?
- [ ] Are regression tests added?
- [ ] Is the fix documented if non-obvious?
