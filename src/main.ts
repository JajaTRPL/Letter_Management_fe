import './style.css'
import 'toastify-js/src/toastify.css'
import { renderLogin, handleRedirection } from './login/Login'

// Guard against Vite HMR re-executing this file and overwriting the current page.
// Without this, every HMR update re-runs handleRedirection(), which always renders
// the dashboard and replaces whatever page the user is currently viewing.
if (!(window as any).__APP_INITIALIZED__) {
    (window as any).__APP_INITIALIZED__ = true;

    const token = localStorage.getItem('auth_token')
    const role = localStorage.getItem('auth_role')

    if (token && role) {
        handleRedirection(role)
    } else {
        renderLogin()
    }
}

// Accept HMR updates without triggering a full page reload.
// This prevents the module from being re-executed on file changes.
if (import.meta.hot) {
    import.meta.hot.accept()
}
