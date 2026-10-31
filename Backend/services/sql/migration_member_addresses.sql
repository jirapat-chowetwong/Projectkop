-- ============================================================
-- เพิ่มตารางที่อยู่จัดส่งเพิ่มเติมของสมาชิก (รันซ้ำได้ ไม่ลบข้อมูลเดิม)
-- ที่อยู่หลักยังอยู่ที่ members.address ตารางนี้เก็บที่อยู่ "เพิ่มเติม"
-- ============================================================
CREATE TABLE IF NOT EXISTS member_addresses (
    id         SERIAL PRIMARY KEY,
    member_id  INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    address    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_member_addresses_member ON member_addresses(member_id);
