import { useMemo } from "react"
import { useLanguage } from "@/contexts/LanguageContext"

export function useLocalizedPath() {
  const { language } = useLanguage()

  const getLocalizedPath = useMemo(() => {
    return (path: string): string => {
      if (language === "zh") {
        return `/zh-CN${path === "/" ? "" : path}`
      }
      return path
    }
  }, [language])

  return { getLocalizedPath }
}
