import { Bell, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useT } from '../../lib/i18n';
import { clearAppData, listAppData } from '../../lib/localData';
import { notifyPermission, requestNotifyPermission, type NotifyPermission } from '../../lib/notify';
import { clearAlerts } from '../../state/arrivalAlerts';
import { Banner } from '../ui/Banner';
import { btn } from '../ui/buttonStyles';
import { Section } from '../ui/Section';
import { useToast } from '../ui/Toast';
import { PanelHeader } from './PanelHeader';

const PERMISSION_TEXT: Record<NotifyPermission, [string, string]> = {
  granted: ['อนุญาตแล้ว', 'Allowed'],
  denied: [
    'ถูกปิดไว้ เปิดใหม่ได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์ (ไอคอนแม่กุญแจข้างแถบที่อยู่)',
    'Blocked. Turn it back on in your browser’s site settings (the padlock next to the address bar).',
  ],
  default: ['ยังไม่ได้ขออนุญาต', 'Not asked yet'],
  unsupported: ['เบราว์เซอร์นี้ไม่รองรับ จะแจ้งเตือนเป็นแถบในแอปแทน', 'Not supported in this browser; alerts will show as banners in the app.'],
};

const DANGER_BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-red-700 px-4 font-semibold text-white hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700';

export function PrivacyPanel() {
  const toast = useToast();
  const tr = useT();
  const [items, setItems] = useState(() => listAppData());
  const [permission, setPermission] = useState<NotifyPermission>(() => notifyPermission());
  const [confirming, setConfirming] = useState(false);

  const askPermission = async () => {
    const result = await requestNotifyPermission();
    setPermission(result);
    toast(
      result === 'granted'
        ? tr('อนุญาตการแจ้งเตือนแล้ว', 'Notifications allowed')
        : tr('ยังไม่ได้รับอนุญาต จะแจ้งเตือนเป็นแถบในแอปแทน', 'Not allowed; alerts will show as banners in the app'),
      result === 'granted' ? 'success' : 'warning',
    );
  };

  const clearAll = () => {
    clearAlerts();
    const count = clearAppData();
    setItems(listAppData());
    setConfirming(false);
    toast(tr(`ล้างข้อมูลในเครื่องแล้ว ${count} รายการ กำลังโหลดแอปใหม่`, `Cleared ${count} items. Reloading…`), 'success');
    window.setTimeout(() => window.location.reload(), 600);
  };

  return (
    <div className="space-y-5 pb-8">
      <PanelHeader
        title={tr('ความเป็นส่วนตัวและข้อมูลในเครื่อง', 'Privacy and data on this device')}
        subtitle={tr('ต้นแบบนี้ไม่มีบัญชีผู้ใช้และไม่มีเซิร์ฟเวอร์ของแอป', 'This prototype has no user accounts and no app server')}
      />

      <div className="px-4">
        <Banner tone="info" title={tr('ข้อมูลรถเป็นข้อมูลจำลอง', 'Bus data is simulated')}>
          {tr(
            'ตำแหน่งรถ เวลาถึง และความแน่นสร้างขึ้นในเครื่องของคุณเพื่อทดสอบ ไม่ได้ดึงจากระบบจริงของผู้ให้บริการ',
            'Bus positions, arrival times and crowding are generated on your device for testing, not taken from operators’ systems.',
          )}
        </Banner>
      </div>

      <Section title={tr('ข้อมูลที่เก็บในเครื่องนี้', 'Stored on this device')}>
        <ul className="list-disc space-y-1 pl-9 pr-4 text-sm text-ink-soft">
          <li>{tr('รายการโปรด (ป้ายและสายรถ)', 'Favourites (stops and routes)')}</li>
          <li>{tr('จุดเริ่มต้นที่เลือก เฉพาะป้าย สถานที่ หรือตำแหน่งจำลอง', 'Your chosen start point, only if it is a stop, place or the demo location')}</li>
          <li>{tr('ภาษาที่เลือก และโหมดแผนที่ 2D/3D', 'Your language and 2D/3D map choice')}</li>
          <li>
            <strong className="text-ink">{tr('ไม่บันทึกตำแหน่ง GPS ลงเครื่อง', 'Your GPS location is never saved')}</strong>{' '}
            {tr('ใช้คำนวณแล้วทิ้ง', '— it is used and then discarded')}
          </li>
          <li>
            {tr(
              'การแจ้งเตือนรถใกล้ถึงและค่าในหน้าวางแผน เก็บไว้ชั่วคราว หายเมื่อปิดหรือรีโหลดหน้า',
              'Arrival alerts and trip planner inputs are temporary and disappear when you close or reload the page',
            )}
          </li>
        </ul>
      </Section>

      <Section title={tr('การเชื่อมต่อออกนอกเครื่อง', 'Connections outside your device')}>
        <ul className="list-disc space-y-1 pl-9 pr-4 text-sm text-ink-soft">
          <li>
            {tr(
              'ภาพแผนที่โหลดจาก OpenStreetMap (แผนที่ 2D) หรือ OpenFreeMap (แผนที่ 3D) ซึ่งจะเห็นที่อยู่ IP และบริเวณที่คุณเปิดดู (โหมดแผนผังแบบย่อไม่โหลดภาพแผนที่)',
              'Map images come from OpenStreetMap (2D) or OpenFreeMap (3D), which can see your IP address and the area you view (the route diagram loads no map images)',
            )}
          </li>
          <li>
            {tr(
              'เมื่อวางแผนการเดินทาง แอปส่งพิกัดจุดเริ่มและจุดสิ้นสุดของแต่ละช่วงเดินไปยังบริการหาเส้นทางเดินของ FOSSGIS (routing.openstreetmap.de) เพื่อวาดทางเดินตามถนน ถ้าใช้ตำแหน่ง GPS เป็นจุดเริ่มต้น พิกัดนั้นจะถูกส่งไปด้วย',
              'When you plan a trip, the start and end of each walk are sent to the FOSSGIS walking-route service (routing.openstreetmap.de) to draw paths along streets. If your GPS location is the start point, it is sent too.',
            )}
          </li>
          <li>{tr('ฟอนต์ภาษาไทยโหลดจาก Google Fonts', 'Thai fonts load from Google Fonts')}</li>
          <li>
            {tr(
              'เว็บไซต์นี้โฮสต์บน GitHub Pages ซึ่งอาจบันทึกการเข้าชมตามนโยบายของ GitHub',
              'This site is hosted on GitHub Pages, which may log visits under GitHub’s policy',
            )}
          </li>
          <li>
            {tr(
              'รายการโปรดไม่ถูกส่งไปที่ใด ตำแหน่งของคุณถูกส่งเฉพาะกรณีหาเส้นทางเดินตามข้อด้านบน',
              'Favourites are never sent anywhere. Your location is only sent for walking routes, as above.',
            )}
          </li>
        </ul>
      </Section>

      <Section title={tr('การแจ้งเตือน', 'Notifications')}>
        <div className="space-y-2 px-4 text-sm">
          <p className="text-ink-soft">
            <strong className="text-ink">{tr('สถานะ:', 'Status:')}</strong> {tr(...PERMISSION_TEXT[permission])}
          </p>
          {permission === 'default' && (
            <button type="button" onClick={() => void askPermission()} className={btn.secondary}>
              <Bell aria-hidden className="h-4 w-4" />
              {tr('อนุญาตการแจ้งเตือน', 'Allow notifications')}
            </button>
          )}
        </div>
      </Section>

      <Section title={tr('ล้างข้อมูลในเครื่อง', 'Clear data on this device')}>
        <div className="space-y-3 px-4 text-sm">
          <p className="text-ink-soft">
            {items.length > 0
              ? tr(`พบข้อมูลของแอปในเบราว์เซอร์นี้ ${items.length} รายการ`, `${items.length} app items found in this browser`)
              : tr('ไม่พบข้อมูลของแอปที่บันทึกไว้ในเบราว์เซอร์นี้', 'No app data saved in this browser')}
          </p>
          {items.length > 0 && (
            <details className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <summary className="cursor-pointer font-medium">{tr('ดูรายการที่บันทึกไว้', 'Show saved items')}</summary>
              <ul className="mt-2 space-y-1 font-mono text-xs">
                {items.map((it) => (
                  <li key={`${it.area}:${it.key}`}>
                    {it.key}{' '}
                    <span className="text-ink-muted">
                      ({it.area === 'local' ? tr('เก็บถาวร', 'saved') : tr('เฉพาะแท็บนี้', 'this tab only')})
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {!confirming ? (
            <button type="button" onClick={() => setConfirming(true)} className={`${btn.secondary} w-full`}>
              <Trash2 aria-hidden className="h-4 w-4" />
              {tr('ล้างข้อมูลในเครื่อง', 'Clear data on this device')}
            </button>
          ) : (
            <div className="space-y-2">
              <Banner tone="warning" title={tr('ยืนยันการล้างข้อมูล?', 'Clear all data?')}>
                {tr(
                  'รายการโปรด จุดเริ่มต้นที่เลือกไว้ และการแจ้งเตือนจะถูกลบ แล้วแอปจะโหลดใหม่ ย้อนกลับไม่ได้',
                  'Favourites, your start point and alerts will be deleted and the app will reload. This can’t be undone.',
                )}
              </Banner>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirming(false)} className={btn.secondary}>
                  {tr('ไม่ล้าง', 'Cancel')}
                </button>
                <button type="button" onClick={clearAll} className={DANGER_BTN}>
                  <Trash2 aria-hidden className="h-4 w-4" />
                  {tr('ล้างเลย', 'Clear')}
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-ink-muted">
            {tr(
              'ลบเฉพาะข้อมูลของ BusBuddy ข้อมูลของเว็บอื่นจะไม่ถูกลบ ส่วนสิทธิ์ตำแหน่งและการแจ้งเตือนต้องยกเลิกเองในการตั้งค่าเบราว์เซอร์',
              'Only BusBuddy data is removed. Location and notification permissions must be revoked in your browser settings.',
            )}
          </p>
        </div>
      </Section>
    </div>
  );
}