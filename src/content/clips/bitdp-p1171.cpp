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
const int maxn=25,INF=0x3f3f3f3f,mod=1e9+7;
const double eps=1e-8,Pi=acos(-1);
mt19937_64 mt(1145);
int n,m;
int mp[maxn][maxn];
int dp[1<<21][maxn];

void solve() {
    dp[1][1]=0;
    for(int S=1;S<(1<<n);++S) {
        for(int i=1;i<=n;++i) {
            for(int k=1;k<=n;++k) {
                if((S&(1<<(k-1)))||!(S&(1<<(i-1))))
                    continue;
                dp[S|(1<<(k-1))][k]=min(dp[S|(1<<(k-1))][k],dp[S][i]+mp[i][k]);
            }
        }
    }
    int ans=INF;
    for(int i=1;i<=n;++i)
        ans=min(ans,dp[(1<<n)-1][i]+mp[i][1]);
    cout<<ans<<'\n';
}
void init() {
    cin>>n;
    memset(dp,0x3f,sizeof(dp));
    for(int i=1;i<=n;++i) for(int j=1;j<=n;++j)
        cin>>mp[i][j];
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