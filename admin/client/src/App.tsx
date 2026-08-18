import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { useAuth } from './context/AuthContext';
import { ConfirmDialogProvider } from './context/ConfirmDialogContext';
import { BackupsPage } from './pages/BackupsPage';
import { ClipEditorPage } from './pages/ClipEditorPage';
import { ClipsPage } from './pages/ClipsPage';
import { DashboardPage } from './pages/DashboardPage';
import { ImagesPage } from './pages/ImagesPage';
import { LoginPage } from './pages/LoginPage';
import { PostEditorPage } from './pages/PostEditorPage';
import { PostsPage } from './pages/PostsPage';
import { PublishPage } from './pages/PublishPage';
import { SecurityPage } from './pages/SecurityPage';
import { TrashPage } from './pages/TrashPage';
function LoadingScreen({ label }: { label: string }) { return <div className="app-loading"><span className="edition-seal">编</span><p>{label}</p></div>; }
function ProtectedShell() { const { user, loading } = useAuth(); if (loading) return <LoadingScreen label="正在开启编辑部…" />; return user ? <AppShell /> : <Navigate to="/login" replace />; }
function LoginRoute() { const { user, loading } = useAuth(); if (loading) return <LoadingScreen label="正在核对会话…" />; return user ? <Navigate to="/" replace /> : <LoginPage />; }
const router = createBrowserRouter([
  { path: '/login', element: <LoginRoute /> },
  { path: '/', element: <ProtectedShell />, children: [
    { index: true, element: <DashboardPage /> }, { path: '/posts', element: <PostsPage /> },
    { path: '/posts/:slug', element: <PostEditorPage /> }, { path: '/clips', element: <ClipsPage /> },
    { path: '/clips/:slug', element: <ClipEditorPage /> }, { path: '/images', element: <ImagesPage /> },
    { path: '/backups', element: <BackupsPage /> }, { path: '/publish', element: <PublishPage /> },
    { path: '/security', element: <SecurityPage /> }, { path: '/trash', element: <TrashPage /> },
  ] },
  { path: '*', element: <Navigate to="/" replace /> },
]);
export function App() { return <ConfirmDialogProvider><RouterProvider router={router} /></ConfirmDialogProvider>; }
