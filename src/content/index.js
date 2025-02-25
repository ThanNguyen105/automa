import browser from 'webextension-polyfill';
import { nanoid } from 'nanoid';
import { toCamelCase } from '@/utils/helper';
import FindElement from '@/utils/find-element';
import executedBlock from './executed-block';
import blocksHandler from './blocks-handler';
function centerInterview(el) {
  return new Promise(function(resolve, reject){
    Element.prototype.documentOffsetTop = function () {
      return this.offsetTop + (this.offsetParent ? this.offsetParent.documentOffsetTop() : 0);
    };

    var top = el.documentOffsetTop() - (window.innerHeight / 2);
    window.scrollTo(0, top);
    resolve("OK");
  });
  
 
}
function isVisible(domElement) {
  return new Promise(resolve => {
    const o = new IntersectionObserver(([entry]) => {
      resolve(entry.intersectionRatio === 1);
      o.disconnect();
    });
    o.observe(domElement);
  });
}
function handleConditionBuilder({ data, type }) {
  if (!type.startsWith('element')) return null;

  const selectorType = (data.selector.startsWith('/')|| data.selector.startsWith('(/')) ? 'xpath' : 'cssSelector';

  const element = FindElement[selectorType](data);
  const { 1: actionType } = type.split('#');

  if (!element) {
    if (actionType === 'visible' || actionType === 'invisible') return false;

    return null;
  }

  const elementActions = {
    text: () => element.innerText,
    visible: () => {
      var width = element.offsetWidth;
      var height = element.offsetHeight;
      if(width===0 || height===0) return false;
      var result = centerInterview(element).then(data => {
        return isVisible(element)
        
    });
    return result;
    },
    invisible: () => {
      const { visibility, display } = getComputedStyle(element);

      return visibility === 'hidden' || display === 'none';
    },
    attribute: ({ attrName }) => {
      if (!element.hasAttribute(attrName)) return null;

      return element.getAttribute(attrName);
    },
  };

  return elementActions[actionType](data);
}

(() => {
  if (window.isAutomaInjected) return;

  window.isAutomaInjected = true;

  browser.runtime.onMessage.addListener((data) => {
    return new Promise((resolve, reject) => {
      if (data.isBlock) {
        const removeExecutedBlock = executedBlock(
          data,
          data.executedBlockOnWeb
        );

        const handler = blocksHandler[toCamelCase(data.name)];

        if (handler) {
          handler(data)
            .then((result) => {
              removeExecutedBlock();
              resolve(result);
            })
            .catch(reject);

          return;
        }
        console.error(`"${data.name}" doesn't have a handler`);

        resolve('');
        return;
      }

      switch (data.type) {
        case 'condition-builder':
          resolve(handleConditionBuilder(data.data));
          break;
        case 'content-script-exists':
          resolve(true);
          break;
        case 'give-me-the-frame-id':
          browser.runtime.sendMessage({
            type: 'this-is-the-frame-id',
          });
          resolve();
          break;
        case 'loop-elements': {
          const selectors = [];
          const attrId = nanoid(5);
          const elements = document.body.querySelectorAll(data.selector);

          elements.forEach((el, index) => {
            if (data.max > 0 && selectors.length - 1 > data.max) return;

            const attrName = 'automa-loop';
            const attrValue = `${attrId}--${index}`;

            el.setAttribute(attrName, attrValue);
            selectors.push(`[${attrName}="${attrValue}"]`);
          });

          resolve(selectors);
          break;
        }
        default:
      }
    });
  });
})();
