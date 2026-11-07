import { Modal } from '@/shared/ui/Modal';
import { ALL_TOOLS } from '@/entities/calculator';
import { APP_VERSION } from '@/shared/config/constants';

export function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="关于本工具"
      titleId="about-title"
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={onClose}>
          确定
        </button>
      }
    >
      <div className="modal-body">
        <p>
          <b>calcbridge</b> {APP_VERSION} — 面板式工程计算工具，共 {ALL_TOOLS.length} 个模块。
        </p>
        <p className="dim">由樂創（LeChuang）制作与维护。</p>
        <p className="dim">
          量纲安全输入 · 正/反向求解 · 可行域判定 · 不确定度分析 · 内置算例回归。
        </p>
        <p className="dim">
          各模块输入草稿自动保存在本机浏览器，切换页面或刷新后恢复；可在「设置」中清除全部草稿。
        </p>
        <p className="dim">
          「文件」菜单可导出/导入设计文件（JSON），稳压器页可导入/导出参数文件；导入前会校验格式、大小与数值范围。
        </p>
        <p className="dim">所有结果为工程估算，非认证依据；安全相关项需实测或送认证。</p>
      </div>
    </Modal>
  );
}
