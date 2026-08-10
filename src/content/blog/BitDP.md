---
title: "状态压缩 DP 笔记"
description: "状态压缩动态规划通过将一个状态集合压缩到一个数里，将对未来决策等价的搜索历史合并为同一个 DP 状态，通常能把一些阶乘复杂度的算法优化到指数级。"
publishedAt: 2026-07-30
updatedAt: 2026-08-10
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

它们访问过的集合都是 $\{1,2,3,4\}$，当前位置也都是 $4$。此后还可以访问的城市完全相同，从 $4$ 前往下一座城市的代价也相同。对于后续决策，只需要保留“访问集合”和“当前位置”。

所以我们可以使用动态规划来优化这个算法。假设我们已经经过了 $S$ 集合中的城市，现在在 $k$ 这个城市，两个城市间的距离为 $w(u,v)$，将已经经过的城市的顺序去掉，压缩到一个已经经过的城市集合 $S$，和一个现在我们在的城市 $k$。

状态转移方程即：
$$
dp_{S,k}=\min_{i \in S \setminus \{k\}} dp_{S \setminus \{k\},i} + w(i,k)
$$
这样我们只需要枚举已经经过的城市集合，当前所在城市还有下一个要去的城市。城市集合的种类有 $O(2^n)$ 种，所以复杂度降至 $O(n^2\cdot 2^n)$。

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
            // 如果下个城市已经去过了或当前城市不在经过集合就跳过
            if((S & (1<<(k-1))) || !(S & (1<<(i-1)))) 
                continue;
            dp[S | (1<<(k-1))][k] = min(dp[S | (1<<(k-1))][k],dp[S][i]+w(i,k));
        }
    }
}
```

初始可以固定为从 $1$ 出发，状态为 $dp_{\{1\},1} = 0$，其余状态赋值为 $+\infty$，最终答案就是 $\min_{i=1}^{n} \{dp_{U,i}+w(i,1)\}$，其中 $U$ 为全集。

```problem
code: P1171
title: 售货员的难题
url: https://www.luogu.com.cn/problem/P1171
difficulty: green
categories: 状态压缩，动态规划
```

本文中的递推式主要采用逆向形式：固定当前状态，枚举最后一步并删除最后加入的元素。实际代码通常采用正向枚举：从状态 $S$ 出发，枚举一个尚未选择的元素，转移到 $S$ 加入该元素后的状态。两种写法只是观察递推的方向不同。

```clip
title: AC Code
description: 使用状态压缩 DP 解决洛谷 P1171 的 AC 代码。
language: cpp
file: p1171.cpp
createdAt: 2026-08-03
```

状态压缩本身只是一种状态表示方式。真正将复杂度从阶乘级降低到指数级的，是动态规划对等价搜索状态的合并。

## 排列顺序型状压 DP

```problem
code: ABC041D
title: 徒競走
url: https://atcoder.jp/contests/abc041/tasks/abc041_d
difficulty: green
categories: 状态压缩，动态规划
```

本题为拓扑序计数。我们回忆拓扑序的概念，可以发现一条有向边相当于一个点排列顺序的限制。即对于一条边 $(u,v)$，反映在排列中为 $u$ 必须在 $v$ 前面出现。暴力方法同样是必须枚举所有点排列计数，复杂度为 $O(n!)$。

和旅行商问题一样，我们可以忽略已经经过的点的顺序将当前状态表示为一个集合 $S$，对于一个点 $u$，如果它的前驱集合 $Pre_u$ 包含于 $S$，我们就可以将 $u$ 加入进 $S$。

令 $dp[S]$ 表示恰好将集合 $S$ 中的点放在排列前 $|S|$ 个位置的合法方案数。枚举最后加入的点 $u$，只有当 $u$ 的所有前驱都已经位于 $S\setminus\{u\}$ 中时，才能进行转移。转移方程：

$$
dp_S
=
\sum_{\substack{u\in S\\
Pre_u\subseteq S\setminus\{u\}}}
dp_{S\setminus\{u\}}
$$

初始状态为空排列 $dp_\varnothing = 1$，最终答案为 $dp_U$，其中 $U$ 是所有点组成的全集。时间复杂度为 $O(n\cdot 2^n)$。

```clip
title: AC Code
description: 使用状态压缩 DP 解决 ABC041D 的 AC 代码。
language: cpp
file: abc041d.cpp
createdAt: 2026-08-06
```

```problem
code: P3694
title: 邦邦的大合唱站队
url: https://www.luogu.com.cn/problem/P3694
difficulty: cyan
categories: 状态压缩，动态规划，前缀和
```

因为最终一个乐队所有偶像都是连续的，不难发现最终状态只有 $m!$ 种，即所有乐队的全排列。暴力做法枚举所有排列，一次枚举计算的复杂度为 $O(n)$，复杂度为 $O(n\cdot m!)$。

和前两个问题相似，我们可以使用状态压缩 DP 将阶乘降至指数级。当我们向已有的乐队集合 $S$ 中添加一个乐队 $u$ 时，不需要暴力枚举这个乐队要占的所有位置，而是使用前缀和优化，令 $used(S)$ 已经使用的位置数，$cnt_u$ 为 $u$ 需要占用的位置数。状态转移方程：

$$
dp_S
=
\min_{u\in S}
\left\{
dp_{S\setminus\{u\}}
+
\sum_{i=used(S\setminus\{u\})+1}^{used(S\setminus\{u\})+cnt_u}
[\![a_i\ne u]\!]
\right\}
$$

其中 `used` 为集合已经占用了的空位数量，`cnt` 为新乐队的偶像数量。初始状态为空集合 $dp_\varnothing=0$，最终答案为 $dp_U$。

```clip
title: AC Code
description: 使用状态压缩 DP 和前缀和解决 P3694 的 AC 代码。
language: cpp
file: p3694.cpp
createdAt: 2026-08-06
```

## 匹配型状压 DP

```problem
code: P4329
title: Bond
url: https://www.luogu.com.cn/problem/P4329
difficulty: green
categories: 状态压缩，动态规划
```

给每个特工分配一个任务使成功概率最大。因为每个特工分配的任务都不一样，所以最终分配序列也会是一个排列。继续使用和前面一样的方法优化暴力枚举全排列，按顺序安排特工，令当前已安排特工集合 $S$，新特工可以选择一个不在 $S$ 里的任务 $i$。可以直接使用当前集合大小加一作为新特工编号。状态转移方程：

$$
dp_S=\max_{i\in S} \{dp_{S\setminus\{i\}}\cdot P[|S|][i]\}
$$

集合大小 $|S|$ 可以使用 `__builtin_popcount` 计算，初始空集合概率为 $1$，最终答案为枚举完所有特工后的 $dp_U$。

```clip
title: AC Code
description: 使用状态压缩 DP 解决 P4329 的 AC 代码。
language: cpp
file: p4329.cpp
createdAt: 2026-08-06
```

```problem
code: AT DP O
title: Matching
url: https://atcoder.jp/contests/dp/tasks/dp_o
difficulty: green
categories: 状态压缩，动态规划
```

把最优化换成计数其实也是一样的。令已经安排集合为 $S$，新人 $i$，匹配函数 $M(u,v)$。状态转移方程：

$$
dp_S
=
\sum_{\substack{u\in S\\
M(|S|,u)}}
dp_{S\setminus\{u\}}
$$

初始空集 $dp_\varnothing = 1$，答案为枚举完所有人后的 $dp_U$。

```clip
title: AC Code
description: 使用状态压缩 DP 解决 AT DP O 的 AC 代码。
language: cpp
file: atdpo.cpp
createdAt: 2026-08-06
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

我们要在 $n\cdot n$ 棋盘上放置 $k$ 个国王使其互不攻击。暴力做法枚举每一个位置是否放置计算，复杂度为 $O(2^{n^2})$。

这个暴力的搜索记录了每一个格子的放置信息。但是当我们在一个格子上放置国王时，只有相邻的 $8$ 个格子会影响到能否放置。所以我们可以只保留会影响的格子的上一行状态和当前状态已经放置了多少个国王。

令每一行的可行状态全集为 $U$，上一行状态为 $S\in U$，当前行 $i$ 状态为 $T\in U$，放置总国王数 $k$，一行的状态里的国王数量 $w$。当 $S$ 和 $T$ 的拼接状态无国王相邻可以转移。转移方程：
$$
dp_{i,T,k}=\sum_{\substack{
(S\cap T)=\varnothing\\
(S\ll1)\cap T=\varnothing\\
(S\gg1)\cap T=\varnothing\\
j=k-w(T)}} dp_{i-1,S,j}
$$
使用位运算 `S<<1` 可以进行对整个集合的平移。我们先预处理所以可行状态，然后枚举每一行和下一行的状态转移，复杂度为 $O(nk\cdot 2^{2n})$。

每次转移只会用到上一行的状态，可以使用滚动数组将空间复杂度优化至 $O(k\cdot 2^n)$。

```clip
title: AC Code
description: 使用状态压缩 DP 解决洛谷 P1896 的 AC 代码。
language: cpp
file: p1896.cpp
createdAt: 2026-08-10
```

## 集合划分 DP

```problem
code: AT DP U
title: Grouping
url: https://atcoder.jp/contests/dp/tasks/dp_u
difficulty: cyan
categories: 状态压缩，动态规划
```

我们要把 $n$ 只兔子划分为若干集合。不过和之前不同，这次无法将这个问题转化为排列枚举了。

先考虑一个暴力算法：枚举划分集合的数量再枚举每只兔子属于哪个集合，对于 $i$ 个划分集合时每个元素可以选 $i$ 种，求和得
$$
\sum_{i=1}^n i^n = O(n^n)
$$

考虑像之前一样舍弃一些无用信息优化这个算法。暴力搜索不仅记录了哪些元素已经完成划分，还记录了这些元素具体被分到了哪些集合中。

然而，后续选择的新集合 $T$ 与已处理集合 $S$ 不相交，并且 $T$ 的贡献只由其内部元素决定，与 $S$ 的历史划分方式无关。因此，对于所有已处理元素集合相同的搜索状态，我们只需要保留当前贡献最大的方案。

令 $dp_S$ 表示将集合 $S$ 划分为若干组所能获得的最大贡献，便可以将大量不同的局部划分合并为同一个 DP 状态。

对于当前已经划分过的状态集合 $S$，我们每次向集合里添加一个和 $S$ 无交集的集合 $T$，元素间贡献 $w$，集合内元素贡献和 $score$，状态转移方程为
$$
dp_S=
\max_{\varnothing\ne T\subseteq S}
\left\{
dp_{S\setminus T}+score_T
\right\}\\
score_T=
\sum_{\substack{i<j\\i,j\in T}}w_{i,j}.
$$

初始状态 $dp_\varnothing=0$，最终答案为枚举所有集合后的 $dp_U$。

计算组内贡献需要枚举所有集合和集合中的两个元素，DP 转移有 $2^n$ 个状态，对每个状态转移需要枚举不相交集合。对于每个元素可以有 $3$ 种选择状态：

* 属于 $S$
* 属于 $T$
* 都不属于

所以总复杂度为 $O(n^2\cdot 2^n + 3^n)=O(3^n)$。

```clip
title: AC Code
description: 使用状态压缩 DP 和子集和解决 AT DP U 的 AC 代码。
language: cpp
file: atdpu.cpp
createdAt: 2026-08-09
```

## SOS DP

```problem
code: CF165E
title: Compatible Numbers
url: https://codeforces.com/problemset/problem/165/E
difficulty: cyan
categories: 状态压缩，动态规划，SOS
```

给定 $n$ 个数，需要对每个数 $a_i$ 找到一个数 $a_j$，使得

$$
a_i\mathbin{\&}a_j=0.
$$

暴力枚举两个数做与运算的复杂度为 $O(n^2)$，无法优化，考虑别的做法。

如果把一个数看成一个二进制集合，那么条件
$a_i\mathbin{\&}a_j=0$ 表示两个集合没有公共元素。

设值域中的二进制位数为 $m$，也就是

$$
0\le a_i<2^m
$$

对于一个数 $S$，能够与它进行 `&` 运算得到 $0$ 的数，必须满足：

$$
T\subseteq \overline{S}
$$

其中 $\overline{S}$ 表示 $S$ 在低 $m$ 位中的补集。因此，如果直接枚举所有可能的 $T$，每个 $S$ 需要枚举 $2^{m-\operatorname{popcount}(S)}$ 个子集。和上一个问题相似，枚举所有子集的复杂度为 $O(3^m)$。不过数比较稀疏可能会快一点。

但是还是无法通过。考虑继续优化，每次都从头计算一遍所有子集，很多部分被重复计算。令 $F_S$ 为状态为 $S$ 时的结果，$f_T$ 为是否存在一个数为 $T$，$A$ 为输入数据构成的集合，我们可以得到

$$
F_S=\max_{T\subseteq \overline{S}} f_T\\
f_T=\begin{cases}
T , & T\in A\\
-1 , & T \notin A
\end{cases}
$$

为什么这里的结果为对所有满足状态的 $\max$ 呢？因为 $\max$ 运算满足结合律(其他满足结合律的运算也可以)，使得我们可以使用一种类似前缀和的技巧优化这个问题。

这个方法就是 `SOS DP`。我们不对每个数单独枚举补集，而是自底向上每次加入一个二进制位递推。

每次枚举一个二进制位，若 $S$ 包含这一位，那么 $S$ 的子集可以分成两类：

* 不包含第 $i$ 位的子集
* 包含第 $i$ 位的子集

每次都将不含这个位的信息合并进 $S$，所以枚举完所有位就可以拼出 $S$ 的完整信息，这样做的复杂度为 $O(m\cdot 2^m)$。

最终每个数的答案就是 $F_{\overline{a_i}}$。

```clip
title: AC Code
description: 使用状态压缩 DP 和 SOS 解决 CF165E 的 AC 代码。
language: cpp
file: cf165e.cpp
createdAt: 2026-08-10
```

## 附录

注意在 `C++` 中位运算的优先级比较低，所以建议所有位运算都要打上括号。

* 空集、全集与单元素集合

type | code
--- | ---
空集 | `int empty = 0;`
低 $n$ 位全集 | `int full = (1 << n) - 1;`
只含元素 $i$ | `int bit = 1 << (i-1);`

虽然状态压缩 DP 一般不会出现，但是当位数可能达到或超过 $31$ 时，不能继续使用 `1 << i`。即使掩码类型是 `long long`，左侧的 `1` 仍然是 `int`，应写成 `1LL << i`。

* 判断、加入、删除与翻转元素

```cpp
bool has = (S & (1 << (i-1))) != 0;  // i 是否在 S 中
int added = S | (1 << (i-1));        // 加入 i
int removed = S & ~(1 << (i-1));     // 删除 i
int toggled = S ^ (1 << (i-1));      // 翻转 i 的存在状态
```

只有已经确定 $i\in S$ 时，`S ^ (1 << (i-1))` 才能当作“删除元素”使用；否则它会把元素加入集合。

* 集合运算

```cpp
int uni  = A | B;       // A 并 B
int inter = A & B;      // A 交 B
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
int pos = __builtin_ctz(S) + 1;    // 最低位 1 的编号，要求 S != 0
```

注意 `__builtin_ctz(0)` 是未定义行为。

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
    int i = __builtin_ctz(T) + 1;
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

* 子集和

```cpp
for (int i = 1; i <= m; ++i) {
    for (int S = 0; S < (1 << m); ++S) {
        if (S & (1 << (i-1))) {
            F[S] += F[S ^ (1 << (i-1))];
        }
    }
}
```

处理后 `F[S]` 为原数组中所有 $T \subseteq S$ 的聚合结果。

* 超集和

```cpp
for (int i = 1; i <= m; ++i) {
    for (int S = 0; S < (1 << m); ++S) {
        if (!(S & (1 << (i-1)))) {
            F[S] += F[S | (1 << (i-1))];
        }
    }
}
```

处理后 `F[S]` 为原数组中所有 $S \subseteq T$ 的聚合结果。
