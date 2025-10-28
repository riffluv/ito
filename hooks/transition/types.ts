export interface TransitionLoadingStep {
  id: string;
  message: string;
  duration: number;
  icon?: string;
  color?: string;
}

export interface TransitionOptions {
  direction?:
    | "slideLeft"
    | "slideRight"
    | "slideUp"
    | "slideDown"
    | "fade"
    | "scale";
  duration?: number;
  showLoading?: boolean;
  loadingSteps?: TransitionLoadingStep[];
}
