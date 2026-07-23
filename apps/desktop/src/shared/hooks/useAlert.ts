import { useContext } from "react";
import { AlertContext } from "../../app/AlertContext";

export const useAlert = () => useContext(AlertContext);
