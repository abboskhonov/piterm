import { StrictMode, Fragment } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/theme-provider.tsx"
import { TooltipProvider } from "@/components/ui/tooltip"

const isDev = import.meta.env.DEV

const Wrapper = isDev ? StrictMode : Fragment

createRoot(document.getElementById("root")!).render(
  <Wrapper>
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        <App />
      </TooltipProvider>
    </ThemeProvider>
  </Wrapper>
)
