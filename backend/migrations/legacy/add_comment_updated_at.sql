-- 迭代 3：Comment 表加 updated_at 字段
-- 用途：支持编辑评论后 updated_at 自动更新
-- 部署前在 MySQL 上执行
-- 注意：MySQL 的 ON UPDATE CURRENT_TIMESTAMP 仅在 5.6.5+ 支持

ALTER TABLE comments
    ADD COLUMN updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    AFTER created_at;

-- 历史数据回填
UPDATE comments SET updated_at = created_at WHERE updated_at IS NULL;
