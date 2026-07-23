import { useContext } from "react";
import { AlertContext } from "../alert";

export const useAlert = () => useContext(AlertContext);
