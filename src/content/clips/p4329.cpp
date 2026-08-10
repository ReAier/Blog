#include<bits/stdc++.h>
#ifndef ONLINE_JUDGE
// #define OPEN_FILE
// #define OPEN_TIME
#endif
#define AC return 0;
#define lowbit(x) (x&(-x))
#define ll long long
#define ull unsigned long long
#define pii pair<int,int>
using namespace std;
const int maxn=20+10,INF=0x3f3f3f3f,mod=1e9+7;
const double eps=1e-8,Pi=acos(-1);
mt19937_64 mt(1145);
int n,m;
double P[maxn][maxn];
double dp[1<<20];

void solve() {
    for(int S=0;S<(1<<n);++S) {
        for(int i=1;i<=n;++i) {
            if(S&(1<<(i-1)))
                continue;
            // 这里和文章不同使用 |S|+1 的原因是新状态比 S 多一个元素 
            dp[S|(1<<(i-1))]=max(dp[S|(1<<(i-1))],
                dp[S]*P[__builtin_popcount(S)+1][i]);
        }
    }
    printf("%.6f\n",dp[(1<<n)-1]*100);
}
void init() {
    cin>>n;
    for(int i=1;i<=n;++i) for(int j=1;j<=n;++j)
        cin>>P[i][j],P[i][j]/=100;
    dp[0]=1;
}
int main() {
#ifdef OPEN_FILE
    freopen("in.txt","r",stdin);
    freopen("out.txt","w",stdout);
#endif
#ifdef OPEN_TIME
    auto StartTime=clock();
#endif
    // ios::sync_with_stdio(false),cin.tie(nullptr),cout.tie(nullptr);
    int T=1;
    // cin>>T;
    // while(cin>>n) {
    while(T--) {
        init();
        solve();
    }
#ifdef OPEN_TIME
    cerr<<"used: "<<(double)(clock()-StartTime)/CLOCKS_PER_SEC*1000<<" ms"<<endl;
#endif
    AC
}