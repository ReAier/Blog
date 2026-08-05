---
title: "状态压缩DP笔记"
description: "状态压缩动态规划通过将一个状态集合压缩到一个数里，通常能把一些阶乘复杂度的算法优化到指数级。"
publishedAt: 2026-07-30
updatedAt: 2026-08-03
tags:
  - 算法竞赛
  - DP
draft: false
featured: true
---
## 旅行商问题

我们从一个经典的问题开始：给定 $n$ 个城市以及这些城市两两之间的距离，要求找出一条最短的闭合回路：旅行商从某个城市出发，恰好访问每个城市一次，最终返回出发城市。

固定起点后，可以枚举其余 $n-1$ 座城市的排列。共有 $(n-1)!$ 种排列，计算一条回路需要 $O(n)$，朴素复杂度为

$$
O(n\cdot(n-1)!)=O(n!).
$$

这个搜索记录了完整访问顺序，但完整顺序对后续并不总是必要。

例如，两条路径分别是

$$
1\to2\to3\to4
\quad\text{和}\quad
1\to3\to2\to4.
$$

它们访问过的集合都是 \(\{1,2,3,4\}\)，当前位置也都是 4。此后还可以访问的城市完全相同，从 4 前往下一座城市的代价也相同。对于后续决策，只需要保留“访问集合”和“当前位置”。

所以我们可以使用动态规划来优化这个算法。假设我们已经经过了 $S$ 集合中的城市，现在在 $k$ 这个城市，两个城市间的距离为 $w(u,v)$，将已经经过的城市的顺序去掉，压缩到一个已经经过的城市集合 $S$，和一个现在我们在的城市 $k$。

状态转移方程即：
$$
dp_{S,k}=\min_{i \in S-\{k\}} dp_{S-\{k\},i} + w(i,k)
$$
这样我们只需要枚举已经经过的城市集合，当前所在城市还有下一个要去的城市。城市集合的种类有 $O(2^n)$ 种，所以复杂度降至 $O(n^22^n)$。

但是这里又涉及到一个问题，我们该如何枚举城市集合。显然我们不可能真的使用 `set` 来枚举。这里就是状态压缩发挥作用的地方了。每一个城市和集合的关系只有两种：在集合里和不在集合里。所以我们将这个集合压缩到一个二进制数中，每一个位代表一个城市的状态，例如当 $n=5$ 时：
$$
S=(10110)_2
$$
表示集合：
$$
\{2,3,5\}
$$
恰好位运算可以实现集合间的交集并集等运算，例如：`&` 与交集，`|` 与并集。所以我们的转移方程可以写为如下的代码：

```cpp
for(int S = 1;S < (1<<n);++ S) {
    for(int i = 1;i <= n;++ i) {
        for(int k = 1;k <= n;++ k) {
            // 如果当前城市和下个城市相同，或者下个城市已经去过了，当前城市不在经过集合就跳过
            if(i == k || (S & (1<<(k-1))) || !(S & (1<<(i-1))))
                continue;
            dp[S | (1<<(k-1))][k] = min(dp[S | (1<<(k-1))][k],dp[S][i]+w(i,k));
        }
    }
}
```

最终答案就是 $\min_{i=1}^{n} \{dp[2^n-1][i]+w(i,1)\}$。

```problem
code: P1171
title: 售货员的难题
url: https://www.luogu.com.cn/problem/P1171
difficulty: green
categories: 状态压缩，动态规划
```

```clip
title: AC代码
description: 使用状态压缩 DP 解决洛谷 P1171 的 AC 代码。
language: cpp
file: bitdp-p1171.cpp
createdAt: 2026-08-03
```

> 未完待续 后期会给例题加上题解

## 排列顺序型状压 DP

这类题不仅关心“选了哪些元素”，还关心最后一个选择的元素，和旅行商问题没有本质区别。

```problem
code: CF580D
title: Kefa and Dishes
url: https://codeforces.com/problemset/problem/580/D
difficulty: green
categories: 状态压缩，动态规划
```

```problem
code: P3694
title: 邦邦的大合唱站队
url: https://www.luogu.com.cn/problem/P3694
difficulty: cyan
categories: 状态压缩，动态规划，前缀和
```

```problem
code: ABC041D
title: 徒競走
url: https://atcoder.jp/contests/abc041/tasks/abc041_d
difficulty: green
categories: 状态压缩，动态规划
```

## 匹配型状压 DP

典型状态：`dp[S]` = 已经分配了集合 $S$ 中任务时的最优答案当前安排到第几个人，可以通过 $k=\operatorname{popcount}(S)$ 直接计算，不需要多开一维。

```problem
code: P4329
title: Bond
url: https://www.luogu.com.cn/problem/P4329
difficulty: green
categories: 状态压缩，动态规划
```

```problem
code: AT DP O
title: Matching
url: https://atcoder.jp/contests/dp/tasks/dp_o
difficulty: green
categories: 状态压缩，动态规划
```

## 集合划分 DP

```problem
code: AT DP U
title: Grouping
url: https://atcoder.jp/contests/dp/tasks/dp_u
difficulty: cyan
categories: 状态压缩，动态规划
```

## 棋盘 / 轮廓线 DP

这类题通常用一个二进制数表示某一行的摆放状态：`dp[i][S]` = 处理完前 $i$ 行，当前行状态为 $S$ 的答案。

```problem
code: P1896
title: 互不侵犯
url: https://www.luogu.com.cn/problem/P1896
difficulty: cyan
categories: 状态压缩，动态规划，轮廓线
```

## SOS DP

```problem
code: CF165E
title: Compatible Numbers
url: https://codeforces.com/problemset/problem/165/E
difficulty: cyan
categories: 状态压缩，动态规划
```

## 附录

注意在 `c++` 中位运算的优先级比较低，所以建议所有位运算都要打上括号。

* 空集、全集与单元素集合

type | code
--- | ---
空集 | `int empty = 0;`
低 $n$ 位全集 | `int full = (1 << n) - 1;`
只含元素 $i$ | `int bit = 1 << (i-1);`

虽然状态压缩dp一般不会出现，但是当位数可能达到或超过 $31$ 时，不能继续使用 `1 << i`。即使掩码类型是 `long long`，左侧的 `1` 仍然是 `int`，应写成 `1LL << i`。

* 判断、加入、删除与翻转元素

```cpp
bool has = (S & (1 << (i-1))) != 0;  // i 是否在 S 中
int added = S | (1 << (i-1));        // 加入 i
int removed = S & ~(1 << (i-1));     // 删除 i
int toggled = S ^ (1 << (i-1));      // 翻转 i 的存在状态
```

只有已经确定 $i\in S$ 时，`S ^ (1 << i)` 才能当作“删除元素”使用；否则它会把元素加入集合。

* 集合运算

```cpp
int uni  = A | B;       // A 交 B
int inter = A & B;      // A 并 B
int diff = A & ~B;      // A 减 B
int symDiff = A ^ B;    // 对称差
int comp = full ^ A;    // A 在低 n 位全集中的补集
```

不要直接使用 `~A` 表示补集，因为它会翻转整数类型中的所有位，而不仅是低 $n$ 位。

* 集合关系

```cpp
bool subset = (A & B) == A;       // A 是 B 的子集
bool disjoint = (A & B) == 0;     // A 与 B 不相交
bool intersects = (A & B) != 0;   // A 与 B 有交集
```

* 集合大小、最低位与删除最低位

```cpp
int cnt32 = __builtin_popcount(S); // S 集合大小
int lowbit = S & -S;               // 只保留最低位的 1
int erased = S & (S - 1);          // 删除最低位的 1
int pos = __builtin_ctz(S);        // 最低位 1 的编号，要求 S != 0
```

* 枚举所有状态和集合中的元素

```cpp
for (int S = 0; S < (1 << n); ++S) {
    // S 枚举低 n 位表示的所有集合
}
for (int i = 1; i <= n; ++i) {
    if (S & (1 << (i-1))) {
        // i 属于 S
    }
}
for (int T = S; T; T &= T - 1) {
    int i = __builtin_ctz(T);
    // i 是 S 中的一个元素
}
```

* 枚举一个集合的所有子集

枚举非空子集：

```cpp
for (int T = S; T; T = (T - 1) & S) {
    // T 是 S 的非空子集
}
```

包含空集：

```cpp
for (int T = S; ; T = (T - 1) & S) {
    // T 是 S 的子集
    if (T == 0) break;
}
```

若 $|S|=k$，它有 $2^k$ 个子集。枚举所有 $S$ 的所有子集时，每个元素有“不在 $S$” “在 $S$ 但不在 $T$” “同时在 $S,T$”三种归属，因此暴力枚举所有子集的子集和总复杂度为

$$
\sum_{S\subseteq U}2^{|S|}=3^n.
$$

* 枚举一个集合的所有超集

```cpp
for (int T = S; T < (1 << n); T = (T + 1) | S) {
    // S 包含于 T 包含于 full
}
```

固定 $S$ 后，其余 $n-\operatorname{popcount}(S)$ 位可以自由选择，所以超集数量为

$$
2^{n-\operatorname{popcount}(S)}.
$$

* 枚举与一个集合不相交的集合

```cpp
int rest = full ^ S;
for (int T = rest; ; T = (T - 1) & rest) {
    // S & T == 0
    if (T == 0) break;
}
```
