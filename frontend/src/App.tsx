import PassengerView from "./pages/PassengerView"; import Dashboard from "./pages/Dashboard";
export default function App(){return window.location.pathname.startsWith("/dashboard")?<Dashboard/>:<PassengerView/>}
