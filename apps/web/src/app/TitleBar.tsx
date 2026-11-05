import { APP_VERSION } from '@/lib/constants';

/** 顶部品牌区：点击回到工具目录。 */
export function TitleBar({ onHome }: { onHome: () => void }) {
  return (
    <button type="button" className="titlebar" onClick={onHome} title="回到工具目录">
      <img className="tb-mark" src="/icon.svg" alt="" width="18" height="18" />
      <span className="tb-word">calcbridge</span>
      <span className="tb-ver">{APP_VERSION}</span>
    </button>
  );
}
