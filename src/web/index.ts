import { EventName } from "../constants";
import "./styles";
import { runOnTextNode } from "./utils/auto-link";
import DarkModeUtil from "./utils/dark-mode";
import OversizeUtil from "./utils/oversize";
import ResizeUtil from "./utils/smart-resize";
import SpecialHandle from "./utils/special-handle";

export {};

const darkModeStyle = `
  html, body.edo, #edo-container {
    background-color: rgb(37,37,37) !important;
  }
  body {
    color: #fff;
  }
`;

const lightModeStyle = `
  html, body.edo, #edo-container {
    background-color: #fffffe !important;
  }
`;

type EventType = (typeof EventName)[keyof typeof EventName];
type State = {
  isDarkMode: boolean;
  hasImgOrVideo: boolean;
  html: string;
};

class App {
  private ratio = 1;
  private windowInnerWidth = 0;
  private windowHeight = 2000;
  private hasSendOnloadEvent = false;
  private state: State = {
    isDarkMode: false,
    hasImgOrVideo: false,
    html: "",
  };

  constructor() {
    this.windowInnerWidth = window.innerWidth;

    window.setHTML = this.setHTML;
    window.addEventListener("resize", this.onWindowResize);

    this.postMessage(EventName.IsMounted, true);
    this.windowHeight = window.screen.height;
  }

  private setState = <K extends keyof State>(state: Pick<State, K> | State) => {
    const preState = Object.assign({}, this.state);
    const nextState = Object.assign({}, this.state);
    Object.keys(state).forEach((key) => {
      nextState[key as K] = state[key as K] as State[K];
    });
    this.state = nextState;
    this.render();
    if (
      preState.html !== nextState.html ||
      preState.isDarkMode !== nextState.isDarkMode
    ) {
      this.onContentChange();
    }
  };

  private onWindowResize = () => {
    if (this.windowInnerWidth != window.innerWidth) {
      this.windowInnerWidth = window.innerWidth;

      if (this.ratio != 1) {
        location.reload();
      } else {
        this.smartResize();
      }
    }
  };

  private postMessage = (type: EventType, data: any) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: type,
          data: data,
        })
      );
    }
  };

  private setHTML = (params: string) => {
    try {
      const { html, isDarkMode = false } = JSON.parse(params);
      if (html) {
        const htmlStr = decodeURIComponent(html);
        // clear the meta to keep style
        const regMeta = /<meta\s+name=(['"\s]?)viewport\1\s+content=[^>]*>/gi;
        // clear @media for orientation: landscape
        const regOrientation =
          /@media screen and [:()\s\w-]*\(orientation: landscape\)/g;
        const formatHTML = htmlStr
          .replace(regMeta, "")
          .replace(regOrientation, "");
        const hasImgOrVideo = this.calcHasImgOrVideo(formatHTML);
        this.setState({
          html: formatHTML,
          hasImgOrVideo,
          isDarkMode,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  private calcHasImgOrVideo = (html: string) => {
    const box = document.createElement("div");
    box.innerHTML = html;
    const image = box.querySelector("img");
    if (image) {
      return true;
    }
    const video = box.querySelector("video");
    if (video) {
      return true;
    }
    return false;
  };

  private applyDarkMode = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      const baseBackground = DarkModeUtil.rgbColor("rgb(37,37,37)");
      Array.from(container.querySelectorAll("*"))
        .reverse()
        .forEach((node) => {
          if (node instanceof HTMLElement) {
            if (this.shouldApplyRuleDom(node)) {
              DarkModeUtil.applyDarkModeForNode(node, baseBackground);
            }
          }
        });
    } catch (err) {
      // pass
    }
  };

  private autolink = () => {
    // Traverse the new DOM tree and make things that look like links clickable,
    // and ensure anything with an href has a title attribute.
    const textWalker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );

    while (textWalker.nextNode()) {
      const parentElement = textWalker.currentNode.parentElement;
      if (parentElement && !this.shouldApplyRuleDom(parentElement)) {
        continue;
      }
      runOnTextNode(textWalker.currentNode);
    }
  };

  private fixLongURL = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("a")).forEach((ele) => {
        if (this.shouldApplyRuleDom(ele)) {
          OversizeUtil.fixLongURL(ele);
        }
      });
    } catch (err) {
      // pass
    }
  };

  private limitImageWidth = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("img")).forEach((ele) => {
        OversizeUtil.limitImageWidth(ele, container.offsetWidth);
      });
    } catch (err) {
      // pass
    }
  };

  private removeObjectDom = () => {
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    Array.from(container.querySelectorAll("object")).forEach((ele) => {
      ele.addEventListener("click", (e) => {
        ele.style.display = "none";
      });
    });
  };

  private smartResize = () => {
    document.body.style.minWidth = "initial";
    document.body.style.width = "initial";
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    const targetWidth = window.innerWidth;
    const originalWidth = container.scrollWidth;
    if (originalWidth > targetWidth) {
      this.ratio = targetWidth / originalWidth;
      try {
        ResizeUtil.scaleElement(container, originalWidth, this.ratio);
      } catch (err) {
        // pass
      }

      const sheets = document.styleSheets;
      try {
        for (const sheet of sheets) {
          ResizeUtil.zoomFontSizeInCss(sheet, 1.0 / this.ratio);
        }
      } catch (err) {
        // pass
      }

      const fontSizeElements = container.querySelectorAll(
        "*[style], font[size]"
      );
      try {
        for (const element of fontSizeElements) {
          if (element instanceof HTMLElement) {
            if (this.shouldApplyRuleDom(element)) {
              ResizeUtil.zoomText(element, 1.0 / this.ratio);
            }
          }
        }
      } catch (err) {
        // pass
      }
      try {
        if (container.scrollWidth > container.offsetWidth + 20) {
          const elements = container.querySelectorAll(
            "td>a[style], td>span[style], td>font[size]"
          );
          for (const element of elements) {
            if (element instanceof HTMLElement) {
              if (this.shouldApplyRuleDom(element)) {
                ResizeUtil.scaleDownText(
                  element,
                  (container.offsetWidth - 20) / container.scrollWidth
                );
              }
            }
          }
        }
      } catch (err) {
        // pass
      }

      document.body.style.height = container.offsetHeight * this.ratio + "px";
    }
  };

  private specialHandle = () => {
    try {
      const container = document.getElementById("edo-container");
      if (!container) {
        return;
      }
      Array.from(container.querySelectorAll("*")).forEach((node) => {
        if (node instanceof HTMLElement) {
          if (this.shouldApplyRuleDom(node)) {
            SpecialHandle.removeFacebookHiddenText(node);
          }
        }
      });
    } catch (err) {
      // pass
    }
  };

  private shouldApplyRuleDom = (el: HTMLElement) => {
    return el.getBoundingClientRect().top < this.windowHeight;
  };

  private addEventListenerForImage = () => {
    const container = document.getElementById("edo-container");
    if (!container) {
      return;
    }
    const images = Array.from(container.querySelectorAll("img"));

    images.forEach((ele) => {
      // add load event to update webview size
      ele.addEventListener("load", () => {
        if (ele.width > container.offsetWidth) {
          ele.classList.add("edo-limit-width");
          this.debounceOnContentChange();
        }
      });
    });
  };

  private onContentChange = () => {
    if (this.state.isDarkMode) {
      this.applyDarkMode();
    }

    if (this.state.isDarkMode) {
      setTimeout(() => {
        this.onload();
      }, 300);
    } else {
      this.onload();
    }

    this.autolink();
    this.addEventListenerForImage();
    this.removeObjectDom();
    this.fixLongURL();
    this.limitImageWidth();
    this.smartResize();
    this.specialHandle();
  };

  private debounceOnContentChange = debounce(this.onContentChange, 300);

  private onload = () => {
    if (this.hasSendOnloadEvent) {
      return;
    }
    this.hasSendOnloadEvent = true;
    this.postMessage(EventName.OnLoad, true);
  };

  render() {
    const { html, isDarkMode, hasImgOrVideo } = this.state;

    const globalStyleNode = document.querySelector(".global-style");
    if (globalStyleNode) {
      const globalStyle = isDarkMode ? darkModeStyle : lightModeStyle;
      globalStyleNode.innerHTML = globalStyle || "";
    }

    const containerNode = document.querySelector("#container");
    if (containerNode) {
      const paddingClassName = !hasImgOrVideo ? "padding2ex" : "padding2px";
      containerNode.classList.add(paddingClassName);
    }

    const bodyNode = document.querySelector("#body");
    if (bodyNode) {
      bodyNode.innerHTML = html;
    }
  }
}

function debounce<T extends Array<any>>(
  fn: (...args: T) => void,
  delay: number
) {
  let timer: number | null = null; //借助闭包
  return function (...args: T) {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => fn(...args), delay);
  };
}

window.onload = () => new App();
