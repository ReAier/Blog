#include<bits/stdc++.h>
//#define ONLINE_JUDGE

#ifndef ONLINE_JUDGE
#include<ctime>
#define OPEN_FILE
#define OPEN_TIME
#endif

#define ll long long
#define ull unsigned long long
#define AC return 0;
using namespace std;

const int maxn=1e6+10,INF=0x3f3f3f3f,mod=1e9+7;
const double eps=1e-8;
int n,m;
ll dp[10][100][1<<10];
vector<int>st;
int w[1<<10];
void solve(){
    for(int i=1;i<=n;++i){
        for(int k=0;k<=m;++k){
            for(int cur:st){
                for(int pre:st){
                    if((cur&pre)||((cur>>1)&pre)||((cur<<1)&pre)||k<w[cur]) 
                        continue;
                    dp[i][k][cur]+=dp[i-1][k-w[cur]][pre];
                }
            }
        }
    }

    ll ans=0;
    for(int cur:st) ans+=dp[n][m][cur];
    cout<<ans;
}

void init(){
    cin>>n>>m;
    for(int i=0;i<=(1<<n)-1;++i){
        if((i&(i<<1))||(i&(i>>1))) continue;
        int nw=0,ni=i;
        while(ni){
            if(ni&1) nw++;
            ni>>=1;
        }
        st.push_back(i);
        w[i]=nw;
    }
    dp[0][0][0]=1;
}

int main(){
#ifdef OPEN_FILE
    freopen("in.txt", "r", stdin);
    freopen("out.txt", "w", stdout);
#endif
#ifdef OPEN_TIME
    auto StartTime = clock();
#endif
    int T=1;
    // cin>>T;
    // while(cin>>n){
    while(T--){
        init();
        solve();
    }

#ifdef OPEN_TIME
    cerr<<"used: "<<(double)(clock()-StartTime)/CLOCKS_PER_SEC*1000<<" ms"<<endl;
#endif
    AC
}