import {Route,Routes} from "react-router-dom";
import Signup from "./Signup";
import Login from "./Login";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/Login" element={<Login />} />
      <Route path="/Signup" element={<Signup />} />
    </Routes>
  );
}