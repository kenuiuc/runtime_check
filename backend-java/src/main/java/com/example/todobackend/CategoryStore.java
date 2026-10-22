package com.example.todobackend;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class CategoryStore {

    private final ObjectMapper objectMapper;
    private final Path dataFile;
    private final List<Category> categories = new ArrayList<>();

    public CategoryStore(ObjectMapper objectMapper,
                         @Value("${app.data-file:data/categories.json}") String dataFile) {
        this.objectMapper = objectMapper;
        this.dataFile = Path.of(dataFile).toAbsolutePath();
        load();
    }

    public synchronized List<Category> findAll() {
        return List.copyOf(categories);
    }

    public synchronized Category add(String name) {
        Category category = new Category(UUID.randomUUID().toString(), name);
        categories.add(category);
        save();
        return category;
    }

    public synchronized boolean remove(String id) {
        Optional<Category> target = categories.stream()
                .filter(category -> category.id().equals(id))
                .findFirst();
        if (target.isEmpty()) {
            return false;
        }
        categories.remove(target.get());
        save();
        return true;
    }

    private void load() {
        if (!Files.exists(dataFile)) {
            return;
        }
        try {
            Category[] saved = objectMapper.readValue(Files.readString(dataFile), Category[].class);
            categories.addAll(Arrays.asList(saved));
        } catch (IOException error) {
            throw new IllegalStateException("读取分类数据文件失败：" + dataFile, error);
        }
    }

    private void save() {
        try {
            Files.createDirectories(dataFile.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(dataFile.toFile(), categories);
        } catch (IOException error) {
            throw new UncheckedIOException("写入分类数据文件失败：" + dataFile, error);
        }
    }
}
