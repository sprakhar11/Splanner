#!/usr/bin/env python3
"""Seeds realistic Interview Prep sample data so the four tabs have something to show."""

import json
import urllib.request
from datetime import date, timedelta

BASE = "http://127.0.0.1:3001/api"


def post(path, body):
    r = urllib.request.Request(BASE + path, data=json.dumps(body).encode(),
                               method="POST", headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as resp:
        return json.loads(resp.read().decode())


def get(path):
    with urllib.request.urlopen(BASE + path) as resp:
        return json.loads(resp.read().decode())


today = date.today()
d = lambda n: (today + timedelta(days=n)).isoformat()

DSA = [
    ("Two Sum", "EASY", "LEETCODE", "Hash Map", 8, "SOLVED", d(-1), "Tried brute force first, wasted 3 minutes.", ""),
    ("Longest Substring Without Repeating", "MEDIUM", "LEETCODE", "Sliding Window", 24, "SOLVED", d(2), "Off-by-one shrinking the window.", "def lengthOfLongestSubstring(s): ..."),
    ("Trapping Rain Water", "HARD", "LEETCODE", "Two Pointers", 47, "SOLVED", d(0), "Forgot the running max from the right side.", "def trap(h): ..."),
    ("Merge k Sorted Lists", "HARD", "LEETCODE", "Heap", 38, "TO_REVISE", d(0), "Heap comparator on ListNode needs __lt__.", ""),
    ("Course Schedule", "MEDIUM", "LEETCODE", "Topological Sort", 31, "SOLVED", d(5), "Cycle detection via in-degree, not DFS colours.", ""),
    ("Word Ladder", "HARD", "LEETCODE", "BFS", 0, "ATTEMPTED", "", "Timed out building the adjacency map naively.", ""),
    ("Validate BST", "MEDIUM", "GEEKSFORGEEKS", "Tree Traversal", 16, "SOLVED", d(9), "Needed min/max bounds, not just left<root<right.", ""),
    ("Coin Change", "MEDIUM", "LEETCODE", "Dynamic Programming", 27, "TO_REVISE", d(1), "Confused the unbounded and 0/1 loop order.", ""),
]

SD = [
    ("Design a rate limiter", "DISTRIBUTED_SYSTEMS", True, d(-3),
     "Token bucket at the edge, Redis counters behind it. Sliding window log when precision matters.",
     ["Token bucket vs leaky bucket", "Redis vs in-memory counters", "Per-user vs per-IP keys"]),
    ("Design a URL shortener", "DATABASES", True, d(-7),
     "Base62 over an auto-increment id. Read-heavy, so cache aggressively.",
     ["Hash vs counter for key generation", "SQL vs KV store", "Cache TTL vs invalidation"]),
    ("Design a news feed", "ARCHITECTURE_PATTERNS", False, None,
     "Fan-out on write for normal users, fan-out on read for celebrities.",
     ["Push vs pull fan-out", "Ranking freshness vs cost"]),
    ("CDN and cache invalidation", "CACHING", False, None,
     "Pull-through CDN, versioned asset URLs to sidestep invalidation entirely.",
     ["TTL vs explicit purge", "Edge vs origin compute"]),
    ("TCP vs UDP tradeoffs", "NETWORKING", True, d(-12),
     "Ordering and retransmit versus latency. QUIC gets both by rebuilding on UDP.",
     ["Head-of-line blocking", "Handshake round trips"]),
]

LLD = [
    ("Design a parking lot", "STRATEGY", "IMPLEMENTED",
     "Spot allocation strategy swaps per vehicle size.", "class ParkingLot: ..."),
    ("Notification service", "OBSERVER", "IMPLEMENTED",
     "Subscribers register per channel; publisher stays unaware of them.", "class Notifier: ..."),
    ("Pluggable payment gateway", "FACTORY", "IN_PROGRESS",
     "Factory resolves the provider from a config key.", "class GatewayFactory: ..."),
    ("Coffee shop billing", "DECORATOR", "BACKLOG",
     "Each add-on wraps the base beverage and adds cost.", ""),
    ("Refactor the order service", "SOLID", "BACKLOG",
     "Single responsibility violation: it validates, prices, and emails.", ""),
]

HR = [
    ("Shipped the migration after the lead quit", "LEADERSHIP",
     "Two weeks from a compliance deadline, our tech lead resigned and took the only migration context with him.",
     "I owned getting the Postgres migration finished without slipping the date.",
     "I cut scope to the three blocking tables, wrote a rollback script first, and paired with a backend dev daily to spread context.",
     "We shipped four days early with zero rollbacks. I turned the runbook into the team's migration template.",
     ["ownership", "ambiguity", "deadline"]),
    ("Disagreed with my manager on rewriting the parser", "CONFLICT_RESOLUTION",
     "My manager wanted a full rewrite of a fragile CSV parser. I thought it was a three-week detour.",
     "I had to either get alignment or commit to the rewrite honestly.",
     "I spent a day instrumenting the real failure rate, brought data showing 90% of errors came from two edge cases, and proposed fixing those first.",
     "We patched both in two days. Error rate dropped 88% and the rewrite was deprioritised for good.",
     ["disagreement", "data-driven"]),
    ("Shipped a caching bug to production", "FAILURE_AND_GROWTH",
     "I shipped a cache key that omitted the tenant id, so users briefly saw another tenant's dashboard counts.",
     "I needed to contain it and make sure it could not recur.",
     "I rolled back within 11 minutes, wrote the incident report myself, and added a lint rule requiring tenant scoping in every cache key helper.",
     "No data was modified. The lint rule has caught four similar mistakes since.",
     ["failure", "incident", "ownership"]),
    ("Cut p99 latency by 60%", "PROBLEM_SOLVING",
     "Our search endpoint had a 2.1s p99 and support tickets were climbing.",
     "I was asked to find and fix the bottleneck.",
     "I profiled it and found an N+1 query hidden behind a lazy relation, then added a batched loader and a covering index.",
     "p99 dropped to 780ms. I added a latency regression test to CI so it stays there.",
     ["performance", "debugging"]),
    ("Onboarded three engineers in a quarter", "BEHAVIORAL",
     "We tripled team size in one quarter with no onboarding docs.",
     None,
     None,
     None,
     ["mentorship"]),
]

for t, diff, plat, pat, mins, st, due, mist, sol in DSA:
    post("/dsa", {"title": t, "difficulty": diff, "platform": plat, "categoryPattern": pat,
                  "timeTakenMinutes": mins, "status": st, "revisionDue": due or None,
                  "mistakesNotes": mist, "solutionSnippet": sol,
                  "url": f"https://leetcode.com/problems/{t.lower().replace(' ', '-')}/"})

for t, cat, rev, last, notes, tr in SD:
    post("/system-design", {"title": t, "category": cat, "notes": notes,
                            "keyTradeoffs": tr, "isRevised": rev, "lastRevised": last})

for t, pat, st, desc, code in LLD:
    post("/lld", {"title": t, "pattern": pat, "status": st, "description": desc, "codeSnippet": code})

for t, cat, s, ta, a, r, tags in HR:
    post("/hr-stories", {"title": t, "questionCategory": cat, "situation": s or "",
                         "task": ta or "", "action": a or "", "result": r or "", "tags": tags})

print(f"dsa            {len(get('/dsa'))}")
print(f"system-design  {len(get('/system-design'))}")
print(f"lld            {len(get('/lld'))}")
print(f"hr-stories     {len(get('/hr-stories'))}")
print("\nSeeded. One HR story is deliberately incomplete to exercise the 2/4 STAR warning.")
