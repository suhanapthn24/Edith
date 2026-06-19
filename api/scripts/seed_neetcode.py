"""
Seed NeetCode 150 categories and problems for the dev user.
Run from the api/ directory: python scripts/seed_neetcode.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from config import settings
from models.dsa import DSACategory, DSAProblem

DEV_USER_ID = "00000000-0000-0000-0000-000000000001"

CATEGORIES = [
    (1,  "Arrays & Hashing",        9),
    (2,  "Two Pointers",             5),
    (3,  "Sliding Window",           6),
    (4,  "Stack",                    7),
    (5,  "Binary Search",            7),
    (6,  "Linked List",             11),
    (7,  "Trees",                   15),
    (8,  "Tries",                    3),
    (9,  "Heap / Priority Queue",    7),
    (10, "Backtracking",             9),
    (11, "Graphs",                  13),
    (12, "Advanced Graphs",          6),
    (13, "1-D Dynamic Programming", 12),
    (14, "2-D Dynamic Programming", 11),
    (15, "Greedy",                   8),
    (16, "Intervals",                6),
    (17, "Math & Geometry",          8),
    (18, "Bit Manipulation",         7),
]

PROBLEMS_RAW = [
    (1,1,"Contains Duplicate",217,"contains-duplicate","Easy"),
    (1,2,"Valid Anagram",242,"valid-anagram","Easy"),
    (1,3,"Two Sum",1,"two-sum","Easy"),
    (1,4,"Group Anagrams",49,"group-anagrams","Medium"),
    (1,5,"Top K Frequent Elements",347,"top-k-frequent-elements","Medium"),
    (1,6,"Product of Array Except Self",238,"product-of-array-except-self","Medium"),
    (1,7,"Valid Sudoku",36,"valid-sudoku","Medium"),
    (1,8,"Encode and Decode Strings",271,"encode-and-decode-strings","Medium"),
    (1,9,"Longest Consecutive Sequence",128,"longest-consecutive-sequence","Medium"),
    (2,1,"Valid Palindrome",125,"valid-palindrome","Easy"),
    (2,2,"Two Sum II",167,"two-sum-ii-input-array-is-sorted","Medium"),
    (2,3,"3Sum",15,"3sum","Medium"),
    (2,4,"Container With Most Water",11,"container-with-most-water","Medium"),
    (2,5,"Trapping Rain Water",42,"trapping-rain-water","Hard"),
    (3,1,"Best Time to Buy and Sell Stock",121,"best-time-to-buy-and-sell-stock","Easy"),
    (3,2,"Longest Substring Without Repeating Characters",3,"longest-substring-without-repeating-characters","Medium"),
    (3,3,"Longest Repeating Character Replacement",424,"longest-repeating-character-replacement","Medium"),
    (3,4,"Permutation in String",567,"permutation-in-string","Medium"),
    (3,5,"Minimum Window Substring",76,"minimum-window-substring","Hard"),
    (3,6,"Sliding Window Maximum",239,"sliding-window-maximum","Hard"),
    (4,1,"Valid Parentheses",20,"valid-parentheses","Easy"),
    (4,2,"Min Stack",155,"min-stack","Medium"),
    (4,3,"Evaluate Reverse Polish Notation",150,"evaluate-reverse-polish-notation","Medium"),
    (4,4,"Generate Parentheses",22,"generate-parentheses","Medium"),
    (4,5,"Daily Temperatures",739,"daily-temperatures","Medium"),
    (4,6,"Car Fleet",853,"car-fleet","Medium"),
    (4,7,"Largest Rectangle in Histogram",84,"largest-rectangle-in-histogram","Hard"),
    (5,1,"Binary Search",704,"binary-search","Easy"),
    (5,2,"Search a 2D Matrix",74,"search-a-2d-matrix","Medium"),
    (5,3,"Koko Eating Bananas",875,"koko-eating-bananas","Medium"),
    (5,4,"Find Minimum in Rotated Sorted Array",153,"find-minimum-in-rotated-sorted-array","Medium"),
    (5,5,"Search in Rotated Sorted Array",33,"search-in-rotated-sorted-array","Medium"),
    (5,6,"Time Based Key-Value Store",981,"time-based-key-value-store","Medium"),
    (5,7,"Median of Two Sorted Arrays",4,"median-of-two-sorted-arrays","Hard"),
    (6,1,"Reverse Linked List",206,"reverse-linked-list","Easy"),
    (6,2,"Merge Two Sorted Lists",21,"merge-two-sorted-lists","Easy"),
    (6,3,"Linked List Cycle",141,"linked-list-cycle","Easy"),
    (6,4,"Reorder List",143,"reorder-list","Medium"),
    (6,5,"Remove Nth Node From End of List",19,"remove-nth-node-from-end-of-list","Medium"),
    (6,6,"Copy List with Random Pointer",138,"copy-list-with-random-pointer","Medium"),
    (6,7,"Add Two Numbers",2,"add-two-numbers","Medium"),
    (6,8,"Find the Duplicate Number",287,"find-the-duplicate-number","Medium"),
    (6,9,"LRU Cache",146,"lru-cache","Medium"),
    (6,10,"Merge K Sorted Lists",23,"merge-k-sorted-lists","Hard"),
    (6,11,"Reverse Nodes in K-Group",25,"reverse-nodes-in-k-group","Hard"),
    (7,1,"Invert Binary Tree",226,"invert-binary-tree","Easy"),
    (7,2,"Maximum Depth of Binary Tree",104,"maximum-depth-of-binary-tree","Easy"),
    (7,3,"Diameter of Binary Tree",543,"diameter-of-binary-tree","Easy"),
    (7,4,"Balanced Binary Tree",110,"balanced-binary-tree","Easy"),
    (7,5,"Same Tree",100,"same-tree","Easy"),
    (7,6,"Subtree of Another Tree",572,"subtree-of-another-tree","Easy"),
    (7,7,"Lowest Common Ancestor of a BST",235,"lowest-common-ancestor-of-a-binary-search-tree","Medium"),
    (7,8,"Binary Tree Level Order Traversal",102,"binary-tree-level-order-traversal","Medium"),
    (7,9,"Binary Tree Right Side View",199,"binary-tree-right-side-view","Medium"),
    (7,10,"Count Good Nodes in Binary Tree",1448,"count-good-nodes-in-binary-tree","Medium"),
    (7,11,"Validate Binary Search Tree",98,"validate-binary-search-tree","Medium"),
    (7,12,"Kth Smallest Element in a BST",230,"kth-smallest-element-in-a-bst","Medium"),
    (7,13,"Construct Binary Tree from Preorder and Inorder Traversal",105,"construct-binary-tree-from-preorder-and-inorder-traversal","Medium"),
    (7,14,"Binary Tree Maximum Path Sum",124,"binary-tree-maximum-path-sum","Hard"),
    (7,15,"Serialize and Deserialize Binary Tree",297,"serialize-and-deserialize-binary-tree","Hard"),
    (8,1,"Implement Trie (Prefix Tree)",208,"implement-trie-prefix-tree","Medium"),
    (8,2,"Design Add and Search Words Data Structure",211,"design-add-and-search-words-data-structure","Medium"),
    (8,3,"Word Search II",212,"word-search-ii","Hard"),
    (9,1,"Kth Largest Element in a Stream",703,"kth-largest-element-in-a-stream","Easy"),
    (9,2,"Last Stone Weight",1046,"last-stone-weight","Easy"),
    (9,3,"K Closest Points to Origin",973,"k-closest-points-to-origin","Medium"),
    (9,4,"Kth Largest Element in an Array",215,"kth-largest-element-in-an-array","Medium"),
    (9,5,"Task Scheduler",621,"task-scheduler","Medium"),
    (9,6,"Design Twitter",355,"design-twitter","Medium"),
    (9,7,"Find Median from Data Stream",295,"find-median-from-data-stream","Hard"),
    (10,1,"Subsets",78,"subsets","Medium"),
    (10,2,"Combination Sum",39,"combination-sum","Medium"),
    (10,3,"Permutations",46,"permutations","Medium"),
    (10,4,"Subsets II",90,"subsets-ii","Medium"),
    (10,5,"Combination Sum II",40,"combination-sum-ii","Medium"),
    (10,6,"Word Search",79,"word-search","Medium"),
    (10,7,"Palindrome Partitioning",131,"palindrome-partitioning","Medium"),
    (10,8,"Letter Combinations of a Phone Number",17,"letter-combinations-of-a-phone-number","Medium"),
    (10,9,"N-Queens",51,"n-queens","Hard"),
    (11,1,"Number of Islands",200,"number-of-islands","Medium"),
    (11,2,"Clone Graph",133,"clone-graph","Medium"),
    (11,3,"Max Area of Island",695,"max-area-of-island","Medium"),
    (11,4,"Pacific Atlantic Water Flow",417,"pacific-atlantic-water-flow","Medium"),
    (11,5,"Surrounded Regions",130,"surrounded-regions","Medium"),
    (11,6,"Rotting Oranges",994,"rotting-oranges","Medium"),
    (11,7,"Walls and Gates",286,"walls-and-gates","Medium"),
    (11,8,"Course Schedule",207,"course-schedule","Medium"),
    (11,9,"Course Schedule II",210,"course-schedule-ii","Medium"),
    (11,10,"Redundant Connection",684,"redundant-connection","Medium"),
    (11,11,"Number of Connected Components in an Undirected Graph",323,"number-of-connected-components-in-an-undirected-graph","Medium"),
    (11,12,"Graph Valid Tree",261,"graph-valid-tree","Medium"),
    (11,13,"Word Ladder",127,"word-ladder","Hard"),
    (12,1,"Reconstruct Itinerary",332,"reconstruct-itinerary","Hard"),
    (12,2,"Min Cost to Connect All Points",1584,"min-cost-to-connect-all-points","Medium"),
    (12,3,"Network Delay Time",743,"network-delay-time","Medium"),
    (12,4,"Swim in Rising Water",778,"swim-in-rising-water","Hard"),
    (12,5,"Alien Dictionary",269,"alien-dictionary","Hard"),
    (12,6,"Cheapest Flights Within K Stops",787,"cheapest-flights-within-k-stops","Medium"),
    (13,1,"Climbing Stairs",70,"climbing-stairs","Easy"),
    (13,2,"Min Cost Climbing Stairs",746,"min-cost-climbing-stairs","Easy"),
    (13,3,"House Robber",198,"house-robber","Medium"),
    (13,4,"House Robber II",213,"house-robber-ii","Medium"),
    (13,5,"Longest Palindromic Substring",5,"longest-palindromic-substring","Medium"),
    (13,6,"Palindromic Substrings",647,"palindromic-substrings","Medium"),
    (13,7,"Decode Ways",91,"decode-ways","Medium"),
    (13,8,"Coin Change",322,"coin-change","Medium"),
    (13,9,"Maximum Product Subarray",152,"maximum-product-subarray","Medium"),
    (13,10,"Word Break",139,"word-break","Medium"),
    (13,11,"Longest Increasing Subsequence",300,"longest-increasing-subsequence","Medium"),
    (13,12,"Partition Equal Subset Sum",416,"partition-equal-subset-sum","Medium"),
    (14,1,"Unique Paths",62,"unique-paths","Medium"),
    (14,2,"Longest Common Subsequence",1143,"longest-common-subsequence","Medium"),
    (14,3,"Best Time to Buy and Sell Stock with Cooldown",309,"best-time-to-buy-and-sell-stock-with-cooldown","Medium"),
    (14,4,"Coin Change II",518,"coin-change-ii","Medium"),
    (14,5,"Target Sum",494,"target-sum","Medium"),
    (14,6,"Interleaving String",97,"interleaving-string","Medium"),
    (14,7,"Longest Increasing Path in a Matrix",329,"longest-increasing-path-in-a-matrix","Hard"),
    (14,8,"Distinct Subsequences",115,"distinct-subsequences","Hard"),
    (14,9,"Edit Distance",72,"edit-distance","Medium"),
    (14,10,"Burst Balloons",312,"burst-balloons","Hard"),
    (14,11,"Regular Expression Matching",10,"regular-expression-matching","Hard"),
    (15,1,"Maximum Subarray",53,"maximum-subarray","Medium"),
    (15,2,"Jump Game",55,"jump-game","Medium"),
    (15,3,"Jump Game II",45,"jump-game-ii","Medium"),
    (15,4,"Gas Station",134,"gas-station","Medium"),
    (15,5,"Hand of Straights",846,"hand-of-straights","Medium"),
    (15,6,"Merge Triplets to Form Target Triplet",1899,"merge-triplets-to-form-target-triplet","Medium"),
    (15,7,"Partition Labels",763,"partition-labels","Medium"),
    (15,8,"Valid Parenthesis String",678,"valid-parenthesis-string","Medium"),
    (16,1,"Insert Interval",57,"insert-interval","Medium"),
    (16,2,"Merge Intervals",56,"merge-intervals","Medium"),
    (16,3,"Non-overlapping Intervals",435,"non-overlapping-intervals","Medium"),
    (16,4,"Meeting Rooms",252,"meeting-rooms","Easy"),
    (16,5,"Meeting Rooms II",253,"meeting-rooms-ii","Medium"),
    (16,6,"Minimum Interval to Include Each Query",1851,"minimum-interval-to-include-each-query","Hard"),
    (17,1,"Rotate Image",48,"rotate-image","Medium"),
    (17,2,"Spiral Matrix",54,"spiral-matrix","Medium"),
    (17,3,"Set Matrix Zeroes",73,"set-matrix-zeroes","Medium"),
    (17,4,"Happy Number",202,"happy-number","Easy"),
    (17,5,"Plus One",66,"plus-one","Easy"),
    (17,6,"Pow(x, n)",50,"powx-n","Medium"),
    (17,7,"Multiply Strings",43,"multiply-strings","Medium"),
    (17,8,"Detect Squares",2013,"detect-squares","Medium"),
    (18,1,"Single Number",136,"single-number","Easy"),
    (18,2,"Number of 1 Bits",191,"number-of-1-bits","Easy"),
    (18,3,"Counting Bits",338,"counting-bits","Easy"),
    (18,4,"Reverse Bits",190,"reverse-bits","Easy"),
    (18,5,"Missing Number",268,"missing-number","Easy"),
    (18,6,"Sum of Two Integers",371,"sum-of-two-integers","Medium"),
    (18,7,"Reverse Integer",7,"reverse-integer","Medium"),
]


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        async with session.begin():
            cat_id_map: dict[int, object] = {}
            for order, name, total in CATEGORIES:
                result = await session.execute(select(DSACategory).where(DSACategory.name == name))
                cat = result.scalar_one_or_none()
                if not cat:
                    cat = DSACategory(name=name, order_index=order, total_problems=total)
                    session.add(cat)
                    await session.flush()
                else:
                    cat.order_index = order
                    cat.total_problems = total
                cat_id_map[order] = cat.id

            global_order = 0
            for cat_order, local_order, title, lc_id, slug, difficulty in PROBLEMS_RAW:
                global_order += 1
                cat_id = cat_id_map[cat_order]
                result = await session.execute(
                    select(DSAProblem).where(
                        DSAProblem.user_id == DEV_USER_ID,
                        DSAProblem.leetcode_id == lc_id,
                    )
                )
                prob = result.scalar_one_or_none()
                if not prob:
                    prob = DSAProblem(
                        user_id=DEV_USER_ID,
                        leetcode_id=lc_id,
                        leetcode_slug=slug,
                        neetcode_category_id=cat_id,
                        title=title,
                        url=f"https://leetcode.com/problems/{slug}/",
                        difficulty=difficulty,
                        is_neetcode_150=True,
                        neetcode_order=global_order,
                    )
                    session.add(prob)
                else:
                    prob.neetcode_category_id = cat_id
                    prob.neetcode_order = global_order
                    prob.difficulty = difficulty
                    prob.leetcode_slug = slug

    await engine.dispose()
    print(f"Seeded {len(PROBLEMS_RAW)} NeetCode 150 problems across {len(CATEGORIES)} categories")


if __name__ == "__main__":
    asyncio.run(seed())
