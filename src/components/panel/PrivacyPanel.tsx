import { Bell, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { clearAppData, listAppData } from '../../lib/localData';
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from '../../lib/notify';
import { clearAlerts } from '../../state/arrivalAlerts';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { useToast } from '../ui/Toast';
import { PanelHeader } from './PanelHeader';

const PERMISSION_TEXT: Record<NotifyPermission, string> = {
  granted: 'อนุญาตแล้ว',
  denied: 'ถูกปิดไว้ เปิดใหม่ได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์ (ไอคอนแม่กุญแจข้างแถบที่อยู่)',
  default: 'ยังไม่ได้ขออนุญาต',
  unsupported: 'เบราว์เซอร์นี้ไม่รองรับ จะแจ้งเตือนเป็นแถบในแอปแทน',
};

const DANGER_BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';

export function PrivacyPanel() {
  const toast = useToast();
  const [items, setItems] = useState(() => listAppData());
  const [permission, setPermission] = useState<NotifyPermission>(() => notifyPermission());
  const [confirming, setConfirming] = useState(false);

  const askPermission = async () => {
    const result = await requestNotifyPermission();
    setPermission(result);
    toast(
      result === 'granted' ? 'อนุญาตการแจ้งเตือนแล้ว' : 'ยังไม่ได้รับอนุญาต จะแจ้งเตือนเป็นแถบในแอปแทน',
      result === 'granted' ? 'success' : 'warning',
    );
  };

  const clearAll = () => {
    clearAlerts();
    const count = clearAppData();
    setItems(listAppData());
    setConfirming(false);
    toast(`ล้างข้อมูลในเครื่องแล้ว ${count} รายการ กำลังโหลดแอปใหม่`, 'success');
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader title="ความเป็นส่วนตัวและข้อมูลในเครื่อง" subtitle="ต้นแบบนี้ไม่มีบัญชีผู้ใช้และไม่มีเซิร์ฟเวอร์ของแอป" />

      <div className="px-4">
        <Banner tone="info" title="ข้อมูลรถเป็นข้อมูลจำลอง">
          ตำแหน่งรถ เวลาถึง และความแน่นสร้างขึ้นในเครื่องของคุณเพื่อทดสอบ ไม่ได้ดึงจากระบบจริงของผู้ให้บริการ
        </Banner>
      </div>

      <Section title="ข้อมูลที่เก็บในเครื่องนี้">
        <ul className="list-disc space-y-1 pl-9 pr-4 text-sm text-ink-soft">
          <li>รายการโปรด (ป้ายและสายรถ)</li>
          <li>จุดเริ่มต้นที่เลือก เฉพาะป้าย สถานที่ หรือตำแหน่งจำลอง</li>
          <li><strong className="text-ink">ไม่บันทึกตำแหน่ง GPS</strong> ใช้คำนวณในเครื่องแล้วทิ้ง</li>
          <li>การแจ้งเตือนรถใกล้ถึงและค่าในหน้าวางแผน เก็บไว้ชั่วคราว หายเมื่อปิดหรือรีโหลดหน้า</li>
        </ul>
      </Section>

      <Section title="การเชื่อมต่อออกนอกเครื่อง">
        <ul className="list-disc space-y-1 pl-9 pr-4 text-sm text-ink-soft">
          <li>ภาพแผนที่โหลดจากผู้ให้บริการแผนที่ ซึ่งจะเห็นที่อยู่ IP และบริเวณที่คุณเปิดดู (โหมดแผนผังแบบย่อไม่โหลดภาพแผนที่)</li>
          <li>ฟอนต์ภาษาไทยโหลดจาก Google Fonts</li>
          <li>เว็บไซต์นี้โฮสต์บน GitHub Pages ซึ่งอาจบันทึกการเข้าชมตามนโยบายของ GitHub</li>
          <li>ตำแหน่งของคุณและรายการโปรดไม่ถูกส่งไปที่ใด</li>
        </ul>
      </Section>

      <Section title="การแจ้งเตือน">
        <div className="space-y-2 px-4 text-sm">
          <p className="text-ink-soft">
            <strong className="text-ink">สถานะ:</strong> {PERMISSION_TEXT[permission]}
          </p>
          {permission === 'default' && (
            <button type="button" onClick={() => void askPermission()} className={btn.secondary}>
              <Bell aria-hidden className="h-4 w-4" />
              อนุญาตการแจ้งเตือน
            </button>
          )}
        </div>
      </Section>

      <Section title="ล้างข้อมูลในเครื่อง">
        <div className="space-y-3 px-4 text-sm">
          <p className="text-ink-soft">
            {items.length > 0
              ? `พบข้อมูลของแอปในเบราว์เซอร์นี้ ${items.length} รายการ`
              : 'ไม่พบข้อมูลของแอปที่บันทึกไว้ในเบราว์เซอร์นี้'}
          </p>
          {items.length > 0 && (
            <details className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <summary className="cursor-pointer font-medium">ดูรายการที่บันทึกไว้</summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {items.map((it) => (
                  <li key={`${it.area}:${it.key}`}>
                    {it.key} <span className="text-ink-muted">({it.area === 'local' ? 'เก็บถาวร' : 'เฉพาะแท็บนี้'})</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className={`${btn.secondary} w-full`}>
              <Trash2 aria-hidden className="h-4 w-4" />
              ล้างข้อมูลในเครื่อง
            </button>
          ) : (
            <div className="space-y-2">
              <Banner tone="warning" title="ยืนยันการล้างข้อมูล?">
                รายการโปรด จุดเริ่มต้นที่เลือกไว้ และการแจ้งเตือนจะถูกลบ แล้วแอปจะโหลดใหม่ ย้อนกลับไม่ได้
              </Banner>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className={btn.secondary}>
                  ไม่ล้าง
                </button>
                <button type="button" onClick={clearAll} className={DANGER_BTN}>
                  <Trash2 aria-hidden className="h-4 w-4" />
                  ล้างเลย
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-ink-muted">
            ลบเฉพาะข้อมูลของ BusBuddy ข้อมูลของเว็บอื่นจะไม่ถูกลบ ส่วนสิทธิ์ตำแหน่งและการแจ้งเตือนต้องยกเลิกเองในการตั้งค่าเบราว์เซอร์
          </p>
        </div>
      </Section>
    </div>
  );
}