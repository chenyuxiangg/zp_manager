# 项目描述

## 背景
一个用管理个人学习计划的网页工具，详见 @docs/README.md

## 要求
项目要求详见 @PM/rules.md

## 进展
- 当前处于敏捷开发迭代2，即RR2，详见 @PM/RR2/03-进展

## 下一步计划
- 实现 @PM/RR2/01-需求 中的需求，遵从方案设计->方案评审并迭代修改->TDD开发->代码检视并迭代修改->集成测试与迭代修改->版本发布 的流程

## 命令
- 构建: cd ${PROJECT_ROOT}/frontend && npm install && npm run build
- 启动后端: pkill -f "flask run" && cd ${PROJECT_ROOT}/backend && ./start.sh &
- 启动前端: cd ${PROJECT_ROOT}/frontend && npm run dev &