import { useState } from "react";
import { MdAddBox, MdCode, MdEmail, MdInsertDriveFile, MdLock ,MdPhone,MdVisibility} from "react-icons/md";
import { FaGraduationCap, FaUser } from "react-icons/fa";


export default function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [facultyCode, setFacultyCode] = useState("");
   const [memberId, setMemberId] = useState("");
   const [mobileNumber, setMobileNumber] = useState("");

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
          <h1>Create Account</h1>
          Join your faculty on CampusRSO
        </div>
        
        <div style={styles.field}> 
            <label style={styles.label}>Full Name</label>
            <div style={styles.inputContainer}>
            <FaUser style={styles.user} />
            <input
            type="text"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
            />
            </div>

        </div>

        <div style={styles.field}> 
            <label style={styles.label}>Email</label>
            <div style={styles.inputContainer}>
            <MdEmail style={styles.user} />
            <input
            type="email"
            placeholder="University Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={styles.input}
            />
            </div>

        </div>

        <div style={styles.field}> 
            <label style={styles.label}>Password</label>
            <div style={styles.inputContainer}>
            <MdLock style={styles.user} />
            <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.input}
            />
            <MdVisibility style={styles.eye} />
            </div>
        </div>

        <div style={styles.field}> 
            <label style={styles.label}>Confirm Password</label>
            <div style={styles.inputContainer}>
            <MdLock style={styles.user} />
            <input
            type="password"
            placeholder="Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={styles.input}
            />
            <MdVisibility style={styles.eye} />
            </div>
        </div>

        <div style={styles.field}> 
            <label style={styles.label}>Faculty Code</label>
            <div style={styles.inputContainer}>
            <MdCode style={styles.user} />
            <input
            type="text"
            placeholder="Faculty Code"
            value={facultyCode}
            onChange={(e) => setFacultyCode(e.target.value)}
            style={styles.input}
            />
            </div>
        </div>


 

        <div style={styles.field}> 
            <label style={styles.label}>Member ID</label>
            <div style={styles.inputContainer}>
            <MdInsertDriveFile style={styles.user} />
            <input
            type="text"
            placeholder="Member ID"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            style={styles.input}
            />
            </div>
        </div>

        <div style={styles.field}> 
            <label style={styles.label}>Mobile Number(Optional)</label>
            <div style={styles.inputContainer}>
            <MdPhone style={styles.user} />
            <input
            type="number"
            placeholder="#+94771234567"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(e.target.value)}
            style={styles.input}
            />
            </div>
        </div>



        
        <button type="submit" style={styles.button}>
          Create Account
        </button>

        <div style={styles.Signup}>
            Already have an account? 
            <a href="/Login">Signin</a>
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
    background:
      "radial-gradient(circle at center, rgba(34, 46, 112, 0.65) 0%, rgba(16, 24, 70, 0.92) 34%, rgba(8, 12, 42, 1) 72%, rgba(5, 8, 27, 1) 100%)",
  },

  inputContainer: {
    display: "flex",
    position: "relative",
    alignItems: "center",
    width: "100%",
  },

    user: {
    padding: "10px",
    paddingLeft: "15px",
    display: "flex",
    position: "absolute",
  },

  eye: {
    fontSize: "20px",
    padding: "10px",
    paddingRight: "15px",
    display: "flex",
    position: "absolute",
    right: "0",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "30px",
    background: "rgba(16, 21, 66, 0.94)",
    borderRadius: "20px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.8)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    width: "400px",
    height: "auto",
  },
  input: {
    color: "white",
    background: "rgba(255, 255, 255, 0.1)",
    border: "none",
    boxShadow: "0 5px 15px rgba(0,0,0,0.3)",
    height: "30px",
    width: "100%",
    padding: "10px",
    paddingLeft: "35px",
    fontSize: "16px",
    margin: "5px",
    borderRadius: "13px",
  
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  welcome:{
    color: "white",
    textAlign: "center",
    marginBottom: "30px",
  },

  cap: {
    marginTop: "5px",
    fontSize: "60px",
    alignSelf: "center",
    textAlign: "center",

  },

  label: {
    color: "white",
    fontSize: "14px",
    fontWeight: "bold",
  },

   forgetPassword: {
    marginLeft: "auto",
    fontSize: "14px",
    fontWeight: "bold",
  },

  Signup: {
    color: "white",
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
    background: "linear-gradient(135deg, rgb(59, 130, 246), rgb(139, 92, 246))",
  },

  button: {
    height: "60px",
    fontSize: "18px",
    fontWeight: "bold",
    borderRadius: "10px",
    padding: "10px",
    background: "linear-gradient(135deg, rgb(59, 130, 246), rgb(139, 92, 246))",
    color: "white",
    border: "none",
    cursor: "pointer",
    margin: "10px 0",
    
  },
};