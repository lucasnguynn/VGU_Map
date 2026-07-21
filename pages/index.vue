<!--
  File này chỉ tồn tại để thỏa mãn Nuxt Router: vì thư mục pages/ đã có
  equipment-[id].vue, Nuxt tự bật chế độ page-routing, và route "/" cần
  khớp với 1 page thì mới không bị lỗi "Page not found: /" khi build/generate
  (xem: https://github.com/nuxt/nuxt/issues/27694).

  Nội dung thực tế của trang chủ KHÔNG nằm ở đây — toàn bộ giao diện bản đồ
  (HologramMap, header, panel...) được render trực tiếp từ app.vue, vì
  app.vue không dùng <NuxtPage />. File này chỉ cần tồn tại, không cần
  hiển thị gì cả.
-->
<template>
  <div></div>
</template>
