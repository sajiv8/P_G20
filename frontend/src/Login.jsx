import { useState } from "react";
import { MdEmail, MdLock } from "react-icons/md";
import { FaGraduationCap } from "react-icons/fa";


export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Email:", email);
    console.log("Password:", password);
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>

        <div style={styles.capContainer}>
          <FaGraduationCap style={styles.cap} />
        </div>

        <div style={styles.welcome}>
          <h1>Welcome Back</h1>
          Sign in to your account
        </div>


        <div style={styles.field}> 
            <label style={styles.label}>Username or Email</label>
            <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            />
        </div>
        
        <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
              />


        </div>


        <div style={styles.forgetPassword}>
            <a href="#">Forget Password?</a>
        </div>



        
        <button type="submit" style={styles.button}>
          Login
        </button>

                <div style={styles.Signup}>
            Don't have an account? 
            <a href="#">Sign up</a>
        </div>

      </form>
    </div>
  );
}

const styles = {
  container: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f4f4f4",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "30px",
    background: "white",
    borderRadius: "10px",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
    width: "300px",
  },
  input: {
    padding: "10px",
    fontSize: "16px",
    borderRadius: "10px"
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  welcome:{
    textAlign: "center",
    marginBottom: "30px",
  },

  cap: {
    fontSize: "60px",
    alignSelf: "center",
    textAlign: "center",

  },

  label: {
    fontSize: "14px",
    fontWeight: "bold",
  },

   forgetPassword: {
    marginLeft: "auto",
    fontSize: "14px",
    fontWeight: "bold",
  },

  Signup: {
    fontSize: "14px",
    fontWeight: "bold",
    alignSelf: "center",
  },

  capContainer: {
    width:80,
    height:70,
    alignSelf: "center",
    borderRadius: "20%",
    textAlign: "center",
    background: "linear-gradient(to right, #6a66f0, #2e2279)",
  },

  button: {
    borderRadius: "10px",
    padding: "10px",
    background: "linear-gradient(to right, #6a66f0, #2e2279)",
    color: "white",
    border: "none",
    cursor: "pointer",
    margin: "10px 0",
    
  },
};