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
const int maxn=1e6+10,INF=0x3f3f3f3f,mod=1e9+7;
const double eps=1e-8,Pi=acos(-1);
mt19937_64 mt(1145);
int n,m;
int a[maxn],sum[maxn][25],cnt[25];
int dp[1<<20];

void solve() {
    for(int S=0;S<(1<<m);++S) {
        int used=0;
        for(int i=1;i<=m;++i) if(S&(1<<(i-1))) 
            used+=cnt[i];
        for(int i=1;i<=m;++i) {
            if(S&(1<<(i-1))) 
                continue;
            dp[S|(1<<(i-1))]=min(dp[S|(1<<(i-1))],
                dp[S]+cnt[i]-(sum[used+cnt[i]][i]-sum[used][i]));
        }
    }
    cout<<dp[(1<<m)-1]<<"\n";
}
void init() {
    cin>>n>>m;
    for(int i=1;i<=n;++i) 
        cin>>a[i],cnt[a[i]]++;
    for(int i=1;i<=n;++i) 
        for(int j=1;j<=m;++j) 
            sum[i][j]=sum[i-1][j]+(a[i]==j);
    memset(dp,0x3f,sizeof(dp));
    dp[0]=0;
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