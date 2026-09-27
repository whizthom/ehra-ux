import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBusinessType } from "../api/businessApi";
import styles from "./BusinessWorkspaceButton.module.css";

export default function BusinessWorkspaceButton() {
  const navigate = useNavigate();
  const [type, setType] = useState(null);
  useEffect(() => { getBusinessType().then(({data}) => setType(data)).catch(() => {}); }, []);
  const ready = type?.businessType === "RETAIL";
  return <button className={styles.button} onClick={() => navigate(ready ? "/retail" : "/business-setup")} title={ready ? "Open Retail Workspace" : "Set up your Business Workspace"}>
    <i className={`ti ${ready ? "ti-building-store" : "ti-rocket"}`} />
    <span>{ready ? "Retail Workspace" : "Set Up Your Business"}</span>
  </button>;
}
