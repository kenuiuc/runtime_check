package com.example.todobackend;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.boot.SpringBootVersion;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class CategoryController {

    private final CategoryStore store;

    public CategoryController(CategoryStore store) {
        this.store = store;
    }

    public record CategoryRequest(String name) {
    }

    @GetMapping("/info")
    public Map<String, Object> info() {
        Map<String, Object> info = new LinkedHashMap<>();
        info.put("service", "Spring Boot 后端");
        info.put("javaVersion", System.getProperty("java.version"));
        info.put("springBootVersion", SpringBootVersion.getVersion());
        info.put("os", System.getProperty("os.name") + " " + System.getProperty("os.arch"));
        info.put("time", java.time.OffsetDateTime.now().toString());
        return info;
    }

    @GetMapping("/categories")
    public List<Category> list() {
        return store.findAll();
    }

    @PostMapping("/categories")
    public ResponseEntity<?> create(@RequestBody(required = false) CategoryRequest request) {
        String name = request == null ? null : request.name();
        if (name == null || name.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "分类名称不能为空"));
        }
        Category category = store.add(name.trim());
        return ResponseEntity.status(HttpStatus.CREATED).body(category);
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        if (!store.remove(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "分类不存在"));
        }
        return ResponseEntity.noContent().build();
    }
}
