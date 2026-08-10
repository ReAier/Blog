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
int pre[maxn];
ll dp[1<<16];

void solve() {
    dp[0]=1;
    for(int S=0;S<(1<<n);++S) {
        for(int u=1;u<=n;++u) {
            if((S&(1<<(u-1))) || ((S&pre[u])!=pre[u]))
                continue;
            dp[S|(1<<(u-1))]+=dp[S];
        }
    }
    cout<<dp[(1<<n)-1]<<"\n";
}
void init() {
    cin>>n>>m;
    int u,v;
    for(int i=1;i<=m;++i)
        cin>>u>>v,pre[v]|=(1<<(u-1));
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